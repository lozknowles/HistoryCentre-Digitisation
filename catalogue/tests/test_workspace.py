"""Behavioural checks use NEW temporary databases, never an archivist's files."""
import hashlib
import io
import json
import time
from pathlib import Path

import pytest
from PIL import Image

from app.card_layout import CARD_FIELDS
from app.db import connect
from app.scan_ocr import apply_dictionary, benchmark_score, capabilities, score_fields
from app.web import create_app
from scripts.create_demo_database import create_demo

HEADERS = {"X-Archive-Request": "workspace"}
ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def workspace(tmp_path, monkeypatch):
    path = tmp_path / "demo.sqlite"
    create_demo(path)
    monkeypatch.setenv("COLLINGHAM_DB", str(path))
    monkeypatch.setenv("COLLINGHAM_UPLOADS", str(tmp_path / "uploads"))
    app = create_app()
    app.config["TESTING"] = True
    yield app, app.test_client(), path
    app.extensions["scan_executor"].shutdown(wait=True)


def manual(**changes):
    result = {"archive_reference_canonical": "DEMO/2026/102", "object_name": "Medicine bottle",
              "title": "Fictional amber chemist bottle", "category": "Bottles & medicine",
              "current_location": "Store B / Box 04", "home_location": "Store B / Box 04",
              "physical_description": "Amber glass with a paper label.", "size": "145 mm high",
              "condition": "Good; empty", "notes": "Fictional training item.", "associated_people": ["Ada Brindlewick"],
              "reviewer": "Demo reviewer", "human_verified": True}
    result.update(changes)
    return result


def test_synthetic_seed_is_exactly_100_and_never_overwrites(workspace):
    _, client, path = workspace
    status = client.get("/api/status").json
    assert status["records"] == 100 and status["synthetic_demo"] is True
    assert len(status["categories"]) == 10 and all(c["count"] == 10 for c in status["categories"])
    assert status["learned_spellings"] == 0
    assert all(r["is_sample"] for r in client.get("/api/records").json["records"])
    before = path.read_bytes()
    with pytest.raises(FileExistsError):
        create_demo(path)
    assert path.read_bytes() == before


def test_manual_accession_persists_front_back_and_audit(workspace):
    _, client, _ = workspace
    response = client.post("/api/records", json=manual(), headers=HEADERS)
    assert response.status_code == 201
    detail = client.get(f"/api/records/{response.json['record_id']}").json
    assert detail["record"]["is_sample"] is True
    assert detail["record"]["associated_people"] == ["Ada Brindlewick"]
    assert detail["record"]["size"] == "145 mm high"
    assert detail["record"]["accession_method"] == "manual"
    assert detail["history"][0]["reviewer_name"] == "Demo reviewer"
    assert client.get("/api/export").json["records"][-1]["title"] == manual()["title"]


@pytest.mark.parametrize("changes", [{"human_verified": False}, {"reviewer": ""}, {"title": ""}, {"archive_reference_canonical": "REAL/2026/1"}, {"associated_people": 12}])
def test_invalid_manual_card_does_not_create_a_record(workspace, changes):
    _, client, _ = workspace
    assert client.post("/api/records", json=manual(**changes), headers=HEADERS).status_code == 400
    assert client.get("/api/status").json["records"] == 100


def test_duplicate_and_stale_edit_are_rejected(workspace):
    _, client, _ = workspace
    rid = client.post("/api/records", json=manual(), headers=HEADERS).json["record_id"]
    assert client.post("/api/records", json=manual(), headers=HEADERS).status_code == 409
    card = client.get(f"/api/records/{rid}").json["record"]
    card.update(reviewer="Second reviewer", notes="Checked the original label.")
    assert client.patch(f"/api/records/{rid}", json=card, headers=HEADERS).status_code == 200
    assert client.patch(f"/api/records/{rid}", json=card, headers=HEADERS).status_code == 409
    detail = client.get(f"/api/records/{rid}").json
    assert detail["record"]["notes"] == "Checked the original label."
    assert any(h["raw_value"] == "Fictional training item." for h in detail["history"])


def test_loan_is_exclusive_restores_location_and_invalidates_stale_editor(workspace):
    _, client, _ = workspace
    record = client.get("/api/records/1").json["record"]
    payload = {"borrower": "Fictional exhibition team", "destination": "Training display case", "due_date": "2026-10-01", "reviewer": "Demo reviewer"}
    response = client.post("/api/records/1/loans", json=payload, headers=HEADERS)
    assert response.status_code == 201
    assert client.post("/api/records/1/loans", json=payload, headers=HEADERS).status_code == 409
    assert client.get("/api/records/1").json["record"]["current_location"] == "Training display case"
    assert client.patch("/api/records/1", json={**record, "reviewer": "Demo reviewer"}, headers=HEADERS).status_code == 409
    loan_id = response.json["loan_id"]
    assert client.post(f"/api/loans/{loan_id}/return", json={"reviewer": "Demo reviewer"}, headers=HEADERS).status_code == 200
    assert client.post(f"/api/loans/{loan_id}/return", json={"reviewer": "Demo reviewer"}, headers=HEADERS).status_code == 409
    assert client.get("/api/records/1").json["record"]["current_location"] == record["current_location"]


def test_browser_write_and_file_boundaries(workspace, monkeypatch):
    _, client, _ = workspace
    assert client.post("/api/records", json=manual()).status_code == 403
    assert client.post("/api/records", json=[], headers=HEADERS).status_code == 400
    assert client.post("/api/scans", data={"file": (io.BytesIO(b"not a pdf"), "card.pdf")}, headers=HEADERS).status_code == 400
    assert client.post("/api/scans", data={"file": (io.BytesIO(b"%PDF-"), "card.exe")}, headers=HEADERS).status_code == 400
    assert client.get("/api/scans/unknown/original").status_code == 404
    monkeypatch.setattr("app.workspace.capabilities", lambda: {"tesseract": False, "pdf": False})
    assert client.post("/api/scans", data={"file": (io.BytesIO(b"%PDF-1.7"), "card.pdf")}, headers=HEADERS).status_code == 503
    assert client.get("/api/status").json["records"] == 100


def photo_bytes():
    stream = io.BytesIO()
    image = Image.new("RGB", (120, 80), "#886a3d")
    exif = Image.Exif()
    exif[274] = 6  # Phone camera orientation: preview must rotate, original retained.
    image.save(stream, "JPEG", exif=exif)
    return stream.getvalue()


def test_item_photo_is_reviewed_before_accession_and_original_is_preserved(workspace):
    _, client, path = workspace
    source = photo_bytes()
    response = client.post("/api/photos", data={"file": (io.BytesIO(source), "camera-photo.jpg")}, headers=HEADERS)
    assert response.status_code == 201
    photo = response.json
    assert (photo["width"], photo["height"]) == (80, 120)
    assert client.get("/api/status").json["records"] == 100
    with connect(path) as conn:
        assert conn.execute("SELECT record_id FROM item_photos").fetchone()[0] is None
    rid = client.post("/api/records", json=manual(photo_ids=[photo["photo_id"]]), headers=HEADERS).json["record_id"]
    detail = client.get(f"/api/records/{rid}").json
    assert detail["record"]["primary_photo_id"] == photo["photo_id"]
    assert detail["record"]["photo_count"] == 1 and len(detail["photos"]) == 1
    assert any(h["field_name"] == "item_photo" for h in detail["history"])
    assert client.get(f"/api/photos/{photo['photo_id']}/original").data == source
    preview = client.get(f"/api/photos/{photo['photo_id']}/preview")
    with Image.open(io.BytesIO(preview.data)) as im:
        assert im.size == (80, 120) and 274 not in im.getexif()
    assert client.post("/api/records", json=manual(archive_reference_canonical="DEMO/2026/104", photo_ids=[photo["photo_id"]]), headers=HEADERS).status_code == 400
    assert client.get("/api/status").json["records"] == 101


def test_bad_photographs_and_missing_photo_ids_do_not_create_accessions(workspace):
    _, client, _ = workspace
    assert client.post("/api/photos", data={"file": (io.BytesIO(b"not an image"), "camera.jpg")}, headers=HEADERS).status_code == 400
    assert client.post("/api/photos", data={"file": (io.BytesIO(photo_bytes()), "camera.png")}, headers=HEADERS).status_code == 400
    assert client.post("/api/records", json=manual(photo_ids=["missing-photo"]), headers=HEADERS).status_code == 400
    assert client.get("/api/status").json["records"] == 100


def test_dictionary_is_exact_non_cascading_and_skips_conflicts():
    variants = [{"variant_text": "Quillrere", "canonical_text": "Quillmere"}, {"variant_text": "Quillmere", "canonical_text": "Different"},
                {"variant_text": "ambiguous", "canonical_text": "One"}, {"variant_text": "ambiguous", "canonical_text": "Two"}]
    raw = {"title": "Quillrere; Quillreres; ambiguous", "archive_reference_canonical": "Quillrere"}
    draft, suggestions = apply_dictionary(raw, variants)
    assert draft["title"] == "Quillmere; Quillreres; ambiguous"
    assert draft["archive_reference_canonical"] == "Quillrere"
    assert raw["title"].startswith("Quillrere;") and len(suggestions) == 1


def test_accuracy_requires_exact_fixture_and_counts_insertions_and_deletions():
    assert benchmark_score("unknown-file", {"title": "one"}, {"title": "one"}) is None
    assert score_fields({"title": "One two THREE."}, {"title": "one three"}) == {"word_accuracy": 66.67, "word_errors": 1, "reference_words": 3}
    assert score_fields({"title": "one two"}, {"title": "one two extra"})["word_errors"] == 1


def wait_for_scan(client, scan_id):
    deadline = time.monotonic() + 90
    while time.monotonic() < deadline:
        result = client.get("/api/scans/" + scan_id).json
        if result["status"] != "processing":
            assert result["status"] == "review", result
            return result
        time.sleep(.1)
    raise AssertionError("OCR did not complete within 90 seconds")


def upload(client, filename):
    source = ROOT / "demo" / "cards" / filename
    with source.open("rb") as stream:
        response = client.post("/api/scans", data={"file": (stream, filename), "profile": "card"}, headers=HEADERS)
    assert response.status_code == 202, response.json
    return wait_for_scan(client, response.json["scan_id"])


def exercise_learning(workspace):
    _, client, path = workspace
    first = upload(client, "01-first-accession.pdf")
    assert first["raw_fields"]["donated_by"] != "Helena Quillmere"
    assert first["benchmark"]["raw"]["word_errors"] > 0
    denied = client.post("/api/records", json={**first["draft_fields"], "scan_id": first["scan_id"], "reviewer": "Demo reviewer", "human_verified": True}, headers=HEADERS)
    assert denied.status_code == 409
    # Explicit human action confirms the name; the test does not simulate OCR.
    for field in first["flagged"]:
        value = "Helena Quillmere" if field in {"donated_by", "associated_people"} else first["draft_fields"][field]
        reply = client.post(f"/api/scans/{first['scan_id']}/review", json={"field": field, "value": value, "remember": field == "donated_by", "reviewer": "Demo reviewer"}, headers=HEADERS)
        assert reply.status_code == 200, reply.json
        reviewed = reply.json
    assert reviewed["benchmark"]["draft"]["word_accuracy"] == 100
    response = client.post("/api/records", json={**reviewed["draft_fields"], "scan_id": first["scan_id"], "reviewer": "Demo reviewer", "human_verified": True}, headers=HEADERS)
    assert response.status_code == 201
    original = client.get(f"/api/scans/{first['scan_id']}/original").data
    assert hashlib.sha256(original).hexdigest() == first["checksum_sha256"]
    later = upload(client, "02-later-accession.pdf")
    assert later["status"] == "review" and later["pending"]
    assert later["raw_fields"]["donated_by"] == first["raw_fields"]["donated_by"]
    assert later["draft_fields"]["donated_by"] == "Helena Quillmere"
    assert len(later["suggestions"]) == 2
    assert later["benchmark"]["draft"]["word_accuracy"] == 100
    assert client.get("/api/status").json["records"] == 101
    entry = client.get("/api/dictionary").json["entries"][0]
    assert entry["reviewer"] == "Demo reviewer"
    assert client.post(f"/api/dictionary/{entry['lexicon_entry_id']}/retire", json={"reviewer": "Demo reviewer"}, headers=HEADERS).status_code == 200
    with connect(path) as conn:
        variants = [dict(r) for r in conn.execute("SELECT variant_text,canonical_text FROM lexicon_variants JOIN lexicon_entries USING(lexicon_entry_id) WHERE status='manual_confirmed'")]
        assert conn.execute("SELECT COUNT(*) FROM scan_reviews").fetchone()[0] == len(first["flagged"])
    assert not apply_dictionary(later["raw_fields"], variants)[1]


def test_complete_review_and_learning_workflow_with_controlled_engine(workspace, monkeypatch):
    """Fast API test. The separate integration below runs the real binary."""
    monkeypatch.setattr("app.workspace.capabilities", lambda: {"tesseract": True, "pdf": True})
    def controlled_engine(source, _folder, _profile):
        checksum = hashlib.sha256(source.read_bytes()).hexdigest()
        fixtures = json.loads((ROOT / "demo" / "benchmark.json").read_text())["fixtures"]
        fields = dict(next(f["expected_fields"] for f in fixtures if f["sha256"] == checksum))
        fields["donated_by"] = fields["associated_people"] = "Helena Quillrere"
        return fields, [], ["donated_by", "associated_people", "archive_reference_canonical"], 2
    monkeypatch.setattr("app.workspace.extract", controlled_engine)
    exercise_learning(workspace)


@pytest.mark.skipif(not all(capabilities().values()), reason="Real OCR integration needs local Tesseract and Poppler")
def test_real_optical_scan_and_later_dictionary_reuse(workspace):
    exercise_learning(workspace)
