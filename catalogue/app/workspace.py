"""Browser workspace API. All OCR is a draft until a named human accessions it."""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

from flask import Blueprint, current_app, jsonify, request, send_file, send_from_directory
from werkzeug.utils import secure_filename

from .card_layout import CARD_FIELDS, LABELS
from .db import connect
from .scan_ocr import apply_dictionary, benchmark_score, capabilities, extract

bp = Blueprint("workspace", __name__)
ROOT = Path(__file__).resolve().parents[1]
TEXT_FIELDS = CARD_FIELDS + ["public_access_summary", "provenance_note"]
DETAIL_FIELDS = ["category", "era", "material"]
LIST_FIELDS = ["associated_people", "associated_places"]


@contextmanager
def database():
    conn = connect(current_app.config["DATABASE_PATH"])
    try:
        with conn:
            yield conn
    finally:
        conn.close()


def fail(message, status=400):
    return jsonify(error=message), status


def is_demo(conn):
    row = conn.execute("SELECT value FROM workspace_meta WHERE key='synthetic_demo'").fetchone()
    return bool(row and row[0] == "true")


def json_body():
    value = request.get_json(silent=True)
    if not isinstance(value, dict):
        raise ValueError("Send a JSON object.")
    return value


def text(value, limit=12000):
    if not isinstance(value, str):
        raise ValueError("Card text must be a string.")
    if len(value) > limit:
        raise ValueError(f"Card text must be at most {limit} characters.")
    return value.strip()


def reviewer(data):
    name = text(data.get("reviewer", ""), 120)
    if not name:
        raise ValueError("Enter the name of the person checking this item.")
    return name


def record_values(data):
    values = {}
    for field in TEXT_FIELDS:
        if field in LIST_FIELDS:
            supplied = data.get(field, [])
            if isinstance(supplied, str):
                supplied = [part.strip() for part in supplied.replace(";", "\n").splitlines() if part.strip()]
            if not isinstance(supplied, list) or len(supplied) > 100:
                raise ValueError("People and places must be a list of names.")
            values[field + "_json"] = json.dumps([text(item, 300) for item in supplied], ensure_ascii=False)
        else:
            values[field] = text(data.get(field, ""))
    for field in ["archive_reference_canonical", "object_name", "title"]:
        if not values[field]:
            raise ValueError(f"{LABELS[field]} is required.")
    if len(values["archive_reference_canonical"]) > 100:
        raise ValueError("The accession reference must be at most 100 characters.")
    values["public_access_summary"] = values["public_access_summary"] or values["brief_description"]
    return values


def serialise_record(row):
    result = dict(row)
    for field in LIST_FIELDS:
        result[field] = json.loads(result.pop(field + "_json", "[]"))
    result["is_sample"] = bool(result["is_sample"])
    return result


RECORD_QUERY = """SELECT r.*, COALESCE(d.category, 'Uncategorised') category,
    COALESCE(d.era, '') era, COALESCE(d.material, '') material,
    COALESCE(d.revision, 1) revision, COALESCE(d.accession_method, 'existing') accession_method,
    (SELECT loan_id FROM item_loans l WHERE l.record_id=r.record_id AND returned_at IS NULL) active_loan_id,
    (SELECT photo_id FROM item_photos p WHERE p.record_id=r.record_id ORDER BY p.created_at,p.rowid LIMIT 1) primary_photo_id,
    (SELECT COUNT(*) FROM item_photos p WHERE p.record_id=r.record_id) photo_count
    FROM catalogue_records r LEFT JOIN record_details d ON d.record_id=r.record_id"""


def audit(conn, record_id, event, field, raw, accepted, who, reason, source=None):
    conn.execute("""INSERT INTO catalogue_record_history
        (record_id,event_type,field_name,raw_value,accepted_value,reviewer_decision,reviewer_name,reason,source_reference)
        VALUES (?,?,?,?,?,'accept',?,?,?)""", (record_id, event, field, raw, accepted, who, reason, source))


@bp.before_request
def guard_browser_write():
    # A custom header forces cross-origin browser requests through a CORS
    # preflight. No CORS permission is granted by this loopback application.
    if request.path.startswith("/api/") and request.method in {"POST", "PATCH", "PUT", "DELETE"}:
        if request.headers.get("X-Archive-Request") != "workspace":
            return fail("Use the archive workspace to make changes.", 403)


@bp.errorhandler(ValueError)
def bad_value(error):
    return fail(str(error))


@bp.errorhandler(sqlite3.IntegrityError)
def conflict(_error):
    return fail("That reference, spelling or open loan already exists. Refresh and check the existing item.", 409)


@bp.get("/workspace/")
@bp.get("/workspace/<path:asset>")
def browser_app(asset="index.html"):
    dist = ROOT.parent / "project" / "dist"
    if not (dist / "index.html").exists():
        return "Build the browser app first: cd project && npm ci && npm run build", 503
    return send_from_directory(dist, asset)


@bp.get("/api/status")
def status():
    with database() as conn:
        counts = {"records": conn.execute("SELECT COUNT(*) FROM catalogue_records").fetchone()[0],
                  "pending_scans": conn.execute("SELECT COUNT(*) FROM scan_jobs WHERE status IN ('review','processing')").fetchone()[0],
                  "learned_spellings": conn.execute("SELECT COUNT(*) FROM lexicon_variants v JOIN lexicon_entries e USING(lexicon_entry_id) WHERE e.status='manual_confirmed'").fetchone()[0],
                  "open_loans": conn.execute("SELECT COUNT(*) FROM item_loans WHERE returned_at IS NULL").fetchone()[0]}
        categories = [dict(row) for row in conn.execute("SELECT COALESCE(d.category,'Uncategorised') name, COUNT(*) count FROM catalogue_records r LEFT JOIN record_details d USING(record_id) GROUP BY name ORDER BY name")]
        workspace_id = conn.execute("SELECT value FROM workspace_meta WHERE key='workspace_id'").fetchone()[0]
        return jsonify(**counts, categories=categories, synthetic_demo=is_demo(conn), workspace_id=workspace_id, ocr=capabilities())


@bp.get("/api/records")
def records():
    with database() as conn:
        return jsonify(records=[serialise_record(row) for row in conn.execute(RECORD_QUERY + " ORDER BY r.record_id DESC")])


@bp.get("/api/records/<int:record_id>")
def record_detail(record_id):
    with database() as conn:
        row = conn.execute(RECORD_QUERY + " WHERE r.record_id=?", (record_id,)).fetchone()
        if not row:
            return fail("Item not found.", 404)
        scan = conn.execute("SELECT scan_id,pages FROM scan_jobs WHERE record_id=?", (record_id,)).fetchone()
        return jsonify(record=serialise_record(row), history=[dict(r) for r in conn.execute("SELECT * FROM catalogue_record_history WHERE record_id=? ORDER BY history_id DESC", (record_id,))],
                       scan_id=scan[0] if scan else None, scan_pages=scan[1] if scan else 0,
                       photos=[photo_json(r) for r in conn.execute("SELECT * FROM item_photos WHERE record_id=? ORDER BY created_at,rowid", (record_id,))],
                       loans=[dict(r) for r in conn.execute("SELECT * FROM item_loans WHERE record_id=? ORDER BY loan_id DESC", (record_id,))])


@bp.post("/api/records")
def accession():
    data = json_body()
    who, values = reviewer(data), record_values(data)
    if data.get("human_verified") is not True:
        return fail("Check the complete card and confirm it is ready to accession.")
    with database() as conn:
        conn.execute("BEGIN IMMEDIATE")
        demo = is_demo(conn)
        if demo and not values["archive_reference_canonical"].startswith("DEMO/"):
            return fail("Use a DEMO/ reference in the fictional training collection.")
        if conn.execute("SELECT 1 FROM catalogue_records WHERE lower(archive_reference_canonical)=lower(?)", (values["archive_reference_canonical"],)).fetchone():
            return fail("That accession reference already exists. Open the existing item or choose a new reference.", 409)
        scan_id, scan = data.get("scan_id"), None
        if scan_id:
            scan = conn.execute("SELECT * FROM scan_jobs WHERE scan_id=?", (scan_id,)).fetchone()
            if not scan or scan["status"] != "review":
                return fail("This scan is not awaiting accession.", 409)
            pending = set(json.loads(scan["flagged_json"])) - set(json.loads(scan["reviewed_json"]))
            if pending:
                return fail("Resolve every highlighted field before accessioning this scan.", 409)
        fixture = bool(scan and benchmark_score(scan["checksum_sha256"], {}, {}))
        values.update(record_slug="item-" + uuid.uuid4().hex, is_sample=int(demo or fixture or data.get("is_sample") is True))
        if scan:
            values.update(source_asset_id=scan["source_asset_id"], ocr_run_id=scan["ocr_run_id"])
        columns = ",".join(values)
        record_id = conn.execute(f"INSERT INTO catalogue_records ({columns}) VALUES ({','.join('?' for _ in values)})", tuple(values.values())).lastrowid
        attach_photos(conn, data.get("photo_ids", []), record_id, who)
        conn.execute("INSERT INTO record_details(record_id,category,era,material,accession_method) VALUES(?,?,?,?,?)", (record_id, *[text(data.get(f, ""), 200) or ("Uncategorised" if f == "category" else "") for f in DETAIL_FIELDS], "scan" if scan else "manual"))
        audit(conn, record_id, "human_review" if scan else "manual_edit", None, None, values["title"], who, "Accessioned after checking the complete card." + (" Synthetic training item." if demo else ""), scan_id)
        if scan:
            final = {f: "; ".join(data[f]) if isinstance(data.get(f), list) else data.get(f, "") for f in CARD_FIELDS}
            audit(conn, record_id, "ocr_import", None, scan["raw_fields_json"], json.dumps(final), who, "Original optical OCR and human-verified card retained.", scan_id)
            for r in conn.execute("SELECT * FROM scan_reviews WHERE scan_id=? ORDER BY review_id", (scan_id,)):
                audit(conn, record_id, "correction", r["field_name"], r["raw_value"], r["accepted_value"], r["reviewer_name"], "Scan review" + ("; spelling remembered." if r["remember"] else "."), scan_id)
            conn.execute("UPDATE scan_jobs SET status='accepted',record_id=?,draft_fields_json=?,updated_at=datetime('now') WHERE scan_id=?", (record_id, json.dumps(final), scan_id))
        return jsonify(record_id=record_id), 201


@bp.patch("/api/records/<int:record_id>")
def edit_record(record_id):
    data = json_body()
    who, values = reviewer(data), record_values(data)
    with database() as conn:
        conn.execute("BEGIN IMMEDIATE")
        old = conn.execute(RECORD_QUERY + " WHERE r.record_id=?", (record_id,)).fetchone()
        if not old:
            return fail("Item not found.", 404)
        if data.get("revision") != old["revision"]:
            return fail("This card changed since you opened it. Refresh before saving.", 409)
        if conn.execute("SELECT 1 FROM catalogue_records WHERE lower(archive_reference_canonical)=lower(?) AND record_id<>?", (values["archive_reference_canonical"], record_id)).fetchone():
            return fail("That accession reference already exists.", 409)
        if is_demo(conn) and not values["archive_reference_canonical"].startswith("DEMO/"):
            return fail("Use a DEMO/ reference in the fictional training collection.")
        if old["active_loan_id"] and values["current_location"] != old["current_location"]:
            return fail("Return the open loan before changing its current location.", 409)
        for field, value in values.items():
            if value != (old[field] or ""):
                audit(conn, record_id, "manual_edit", field, old[field], value, who, "Card amended in the workspace.")
        conn.execute("UPDATE catalogue_records SET " + ",".join(f"{key}=?" for key in values) + ",updated_at=datetime('now') WHERE record_id=?", (*values.values(), record_id))
        conn.execute("INSERT OR IGNORE INTO record_details(record_id) VALUES (?)", (record_id,))
        details = [text(data.get(f, ""), 200) for f in DETAIL_FIELDS]
        for field, value in zip(DETAIL_FIELDS, details):
            if value != old[field]:
                audit(conn, record_id, "manual_edit", field, old[field], value, who, "Collection detail amended.")
        conn.execute("UPDATE record_details SET category=?,era=?,material=?,revision=revision+1 WHERE record_id=?", (*details, record_id))
        attach_photos(conn, data.get("photo_ids", []), record_id, who)
        return jsonify(record_id=record_id)


def photo_json(row):
    return {key: row[key] for key in ["photo_id", "filename", "checksum_sha256", "width", "height"]}


def attach_photos(conn, photo_ids, record_id, who):
    if not isinstance(photo_ids, list) or len(photo_ids) > 12 or any(not isinstance(p, str) for p in photo_ids):
        raise ValueError("Choose at most 12 item photographs.")
    if len(set(photo_ids)) != len(photo_ids):
        raise ValueError("The same photograph was selected more than once.")
    existing_count = conn.execute("SELECT COUNT(*) FROM item_photos WHERE record_id=?", (record_id,)).fetchone()[0]
    to_attach = []
    for photo_id in photo_ids:
        row = conn.execute("SELECT record_id,filename FROM item_photos WHERE photo_id=?", (photo_id,)).fetchone()
        if not row:
            raise ValueError("A selected photograph is no longer available. Choose it again.")
        if row["record_id"] not in {None, record_id}:
            raise ValueError("That photograph already belongs to another accession.")
        if row["record_id"] is None:
            to_attach.append((photo_id, row["filename"]))
    if existing_count + len(to_attach) > 12:
        raise ValueError("An item can have at most 12 photographs.")
    for photo_id, filename in to_attach:
        conn.execute("UPDATE item_photos SET record_id=? WHERE photo_id=?", (record_id, photo_id))
        audit(conn, record_id, "manual_edit", "item_photo", None, filename, who, "Item photograph attached after review.", photo_id)


@bp.post("/api/photos")
def upload_photo():
    file = request.files.get("file")
    if not file or not file.filename:
        return fail("Take a photograph or choose an image.")
    filename = secure_filename(file.filename)
    suffix = Path(filename).suffix.lower()
    allowed = {".jpg": "JPEG", ".jpeg": "JPEG", ".png": "PNG", ".webp": "WEBP"}
    if suffix not in allowed:
        return fail("Choose a JPEG, PNG or WebP photograph. Export HEIC photos as JPEG first.")
    try:
        with Image.open(file.stream) as original_image:
            if original_image.format != allowed[suffix]:
                return fail("The image content does not match its filename.")
            if original_image.width * original_image.height > 30_000_000:
                return fail("Choose a photograph up to 30 megapixels, or use your camera's standard photo size.")
            oriented = ImageOps.exif_transpose(original_image).convert("RGBA")
            preview_image = Image.new("RGB", oriented.size, "white")
            preview_image.paste(oriented, mask=oriented.getchannel("A"))
        width, height = preview_image.size
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        return fail("This photograph could not be read. Try another image.")
    photo_id = uuid.uuid4().hex
    folder = Path(current_app.config["UPLOAD_FOLDER"]) / "item-photos" / photo_id
    folder.mkdir(parents=True)
    original = folder / ("original" + suffix)
    file.stream.seek(0)
    file.save(original)
    checksum = hashlib.sha256(original.read_bytes()).hexdigest()
    preview_image.thumbnail((1800, 1800))
    preview_path = folder / "preview.jpg"
    preview_image.save(preview_path, "JPEG", quality=90)
    with database() as conn:
        conn.execute("INSERT INTO item_photos(photo_id,filename,original_path,preview_path,checksum_sha256,mime_type,width,height) VALUES(?,?,?,?,?,?,?,?)",
                     (photo_id, filename, str(original), str(preview_path), checksum, "image/" + ("jpeg" if suffix in {".jpg", ".jpeg"} else suffix[1:]), width, height))
        return jsonify(photo_json(conn.execute("SELECT * FROM item_photos WHERE photo_id=?", (photo_id,)).fetchone())), 201


@bp.get("/api/photos/<photo_id>/<kind>")
def photo_file(photo_id, kind):
    if kind not in {"preview", "original"}:
        return fail("Photograph not found.", 404)
    with database() as conn:
        row = conn.execute("SELECT * FROM item_photos WHERE photo_id=?", (photo_id,)).fetchone()
        if not row:
            return fail("Photograph not found.", 404)
        return send_file(row["preview_path"] if kind == "preview" else row["original_path"],
                         mimetype="image/jpeg" if kind == "preview" else row["mime_type"],
                         as_attachment=kind == "original", download_name=row["filename"] if kind == "original" else "preview.jpg")


def process_scan(app, scan_id):
    start = time.monotonic()
    with app.app_context():
        try:
            with database() as conn:
                scan = conn.execute("SELECT * FROM scan_jobs WHERE scan_id=?", (scan_id,)).fetchone()
            source = Path(scan["source_path"])
            raw, words, flagged, pages = extract(source, source.parent, scan["profile"])
            with database() as conn:
                variants = [dict(r) for r in conn.execute("SELECT v.variant_text,e.canonical_text FROM lexicon_variants v JOIN lexicon_entries e USING(lexicon_entry_id) WHERE e.status='manual_confirmed'")]
                draft, suggestions = apply_dictionary(raw, variants)
                flagged = sorted(set(flagged) | {s["field"] for s in suggestions})
                asset = conn.execute("INSERT INTO source_assets(asset_kind,source_label,source_path,checksum_sha256,notes) VALUES(?,?,?,?,?)", ("pdf" if source.suffix == ".pdf" else "image", scan["filename"], str(source), scan["checksum_sha256"], "Uploaded original; never overwritten by corrections.")).lastrowid
                run = conn.execute("""INSERT INTO ocr_runs(source_asset_id,model_name,model_path,runtime_summary,inference_dtype,attention_implementation,cpu_offload_enabled,notes)
                    VALUES(?,'Tesseract English','local executable','CPU optical OCR; rendered pixels only','CPU','not applicable',0,?)""", (asset, "Dictionary suggestions require human approval. Profile: " + scan["profile"])).lastrowid
                conn.execute("""UPDATE scan_jobs SET status='review',raw_fields_json=?,draft_fields_json=?,words_json=?,suggestions_json=?,flagged_json=?,pages=?,elapsed_seconds=?,source_asset_id=?,ocr_run_id=?,updated_at=datetime('now') WHERE scan_id=?""",
                             (json.dumps(raw), json.dumps(draft), json.dumps(words), json.dumps(suggestions), json.dumps(flagged), pages, round(time.monotonic() - start, 2), asset, run, scan_id))
        except Exception as error:
            # Keep the source file, record a useful failure, never create a card.
            app.logger.warning("Scan %s failed: %s", scan_id, type(error).__name__)
            message = str(error) if isinstance(error, ValueError) else "The local OCR engine could not read this file. Check the file and OCR installation, then try again."
            with database() as conn:
                conn.execute("UPDATE scan_jobs SET status='failed',error=?,updated_at=datetime('now') WHERE scan_id=?", (message, scan_id))
        finally:
            app.extensions["scan_slots"].release()


@bp.post("/api/scans")
def upload_scan():
    file = request.files.get("file")
    profile = request.form.get("profile", "card")
    if profile not in {"card", "historic", "document"}:
        return fail("Choose the card or document layout.")
    if not file or not file.filename:
        return fail("Choose a PDF, PNG or JPEG to scan.")
    name = secure_filename(file.filename)
    suffix = Path(name).suffix.lower()
    if suffix not in {".pdf", ".png", ".jpg", ".jpeg"}:
        return fail("Choose a PDF, PNG or JPEG to scan.")
    head = file.stream.read(8)
    file.stream.seek(0)
    valid = (suffix == ".pdf" and head.startswith(b"%PDF-")) or (suffix == ".png" and head.startswith(b"\x89PNG\r\n\x1a\n")) or (suffix in {".jpg", ".jpeg"} and head.startswith(b"\xff\xd8\xff"))
    if not valid:
        return fail("The file content does not match its PDF or image extension.")
    available = capabilities()
    if not available["tesseract"] or (suffix == ".pdf" and not available["pdf"]):
        return fail("Install Tesseract and Poppler to scan PDFs locally. Manual accession remains available.", 503)
    app = current_app._get_current_object()
    if not app.extensions["scan_slots"].acquire(blocking=False):
        return fail("The scanner is busy. Wait for a current scan to finish.", 429)
    scan_id = uuid.uuid4().hex
    folder = Path(app.config["UPLOAD_FOLDER"]) / scan_id
    try:
        folder.mkdir(parents=True)
        source = folder / ("original" + suffix)
        file.save(source)
        checksum = hashlib.sha256(source.read_bytes()).hexdigest()
        with database() as conn:
            conn.execute("INSERT INTO scan_jobs(scan_id,filename,source_path,checksum_sha256,profile,status) VALUES(?,?,?,?,?,'processing')", (scan_id, name, str(source), checksum, profile))
        app.extensions["scan_executor"].submit(process_scan, app, scan_id)
    except Exception:
        app.extensions["scan_slots"].release()
        raise
    return jsonify(scan_id=scan_id, status="processing"), 202


def scan_json(row):
    data = dict(row)
    data.pop("source_path")
    for key in ["raw_fields", "draft_fields", "words", "suggestions", "reviewed", "flagged"]:
        data[key] = json.loads(data.pop(key + "_json"))
    data["pending"] = [f for f in data["flagged"] if f not in data["reviewed"]]
    data["benchmark"] = benchmark_score(data["checksum_sha256"], data["raw_fields"], data["draft_fields"]) if data["status"] in {"review", "accepted"} else None
    return data


@bp.get("/api/scans")
def scans():
    with database() as conn:
        return jsonify(scans=[scan_json(row) for row in conn.execute("SELECT * FROM scan_jobs ORDER BY created_at DESC,rowid DESC LIMIT 100")])


@bp.get("/api/scans/<scan_id>")
def scan_detail(scan_id):
    with database() as conn:
        row = conn.execute("SELECT * FROM scan_jobs WHERE scan_id=?", (scan_id,)).fetchone()
        if not row:
            return fail("Scan not found.", 404)
        return jsonify(scan_json(row))


@bp.get("/api/scans/<scan_id>/page/<int:page>")
def preview(scan_id, page):
    with database() as conn:
        row = conn.execute("SELECT source_path,pages FROM scan_jobs WHERE scan_id=?", (scan_id,)).fetchone()
        if not row or page < 1 or page > row["pages"]:
            return fail("Page not found.", 404)
        return send_file(Path(row["source_path"]).parent / f"preview-{page}.png", mimetype="image/png")


@bp.get("/api/scans/<scan_id>/original")
def original(scan_id):
    with database() as conn:
        row = conn.execute("SELECT source_path,filename FROM scan_jobs WHERE scan_id=?", (scan_id,)).fetchone()
        if not row:
            return fail("Scan not found.", 404)
        return send_file(row["source_path"], download_name=row["filename"], as_attachment=True)


def remember_spelling(conn, raw, accepted, field, who, source):
    raw, accepted = text(raw, 200), text(accepted, 200)
    if not raw or not accepted or raw == accepted:
        return False
    conflict = conn.execute("""SELECT e.canonical_text FROM lexicon_variants v JOIN lexicon_entries e USING(lexicon_entry_id)
        WHERE lower(v.variant_text)=lower(?) AND e.status='manual_confirmed' AND lower(e.canonical_text)<>lower(?)""", (raw, accepted)).fetchone()
    if conflict:
        raise ValueError("This OCR spelling already has a different confirmed meaning. Save this card correction without remembering it.")
    kind = "person" if field in {"donated_by", "associated_people"} else "place" if field == "associated_places" else "other"
    conn.execute("INSERT OR IGNORE INTO lexicon_entries(canonical_text,entry_type,status,source_reference) VALUES(?,?,'manual_confirmed',?)", (accepted, kind, source))
    entry = conn.execute("SELECT lexicon_entry_id FROM lexicon_entries WHERE canonical_text=? AND entry_type=?", (accepted, kind)).fetchone()[0]
    conn.execute("UPDATE lexicon_entries SET status='manual_confirmed',updated_at=datetime('now') WHERE lexicon_entry_id=?", (entry,))
    conn.execute("INSERT OR IGNORE INTO lexicon_variants(lexicon_entry_id,variant_text,variant_type,source_reference) VALUES(?,?,'ocr_variant',?)", (entry, raw, source))
    variant = conn.execute("SELECT variant_id FROM lexicon_variants WHERE lexicon_entry_id=? AND variant_text=?", (entry, raw)).fetchone()[0]
    conn.execute("""INSERT INTO lexicon_history(lexicon_entry_id,variant_id,event_type,raw_value,accepted_value,reason,reviewer_decision,reviewer_name,source_reference)
        VALUES(?,?,'review_note',?,?,'Explicitly remembered during scan review','accept',?,?)""", (entry, variant, raw, accepted, who, source))
    return True


@bp.post("/api/scans/<scan_id>/review")
def review_scan(scan_id):
    data = json_body()
    field, accepted, who = data.get("field"), text(data.get("value", "")), reviewer(data)
    if field not in CARD_FIELDS:
        return fail("Unknown card field.")
    if data.get("remember") and field == "archive_reference_canonical":
        return fail("Accession references are checked individually and are not spelling rules.")
    with database() as conn:
        conn.execute("BEGIN IMMEDIATE")
        scan = conn.execute("SELECT * FROM scan_jobs WHERE scan_id=?", (scan_id,)).fetchone()
        if not scan or scan["status"] != "review":
            return fail("This scan is not awaiting review.", 409)
        raw, draft = json.loads(scan["raw_fields_json"]), json.loads(scan["draft_fields_json"])
        remembered = remember_spelling(conn, raw.get(field, ""), accepted, field, who, scan_id) if data.get("remember") else False
        conn.execute("INSERT INTO scan_reviews(scan_id,field_name,raw_value,previous_value,accepted_value,remember,reviewer_name) VALUES(?,?,?,?,?,?,?)", (scan_id, field, raw.get(field, ""), draft.get(field, ""), accepted, int(remembered), who))
        draft[field] = accepted
        reviewed = sorted(set(json.loads(scan["reviewed_json"])) | {field})
        conn.execute("UPDATE scan_jobs SET draft_fields_json=?,reviewed_json=?,updated_at=datetime('now') WHERE scan_id=?", (json.dumps(draft), json.dumps(reviewed), scan_id))
        return jsonify(scan_json(conn.execute("SELECT * FROM scan_jobs WHERE scan_id=?", (scan_id,)).fetchone()))


@bp.get("/api/dictionary")
def dictionary():
    with database() as conn:
        entries = [dict(row) for row in conn.execute("""SELECT v.*,e.canonical_text,e.entry_type,e.status,
            (SELECT reviewer_name FROM lexicon_history h WHERE h.variant_id=v.variant_id ORDER BY lexicon_history_id DESC LIMIT 1) reviewer
            FROM lexicon_variants v JOIN lexicon_entries e USING(lexicon_entry_id) ORDER BY v.variant_id DESC""")]
        return jsonify(entries=entries)


@bp.post("/api/dictionary/<int:entry_id>/retire")
def retire_spelling(entry_id):
    who = reviewer(json_body())
    with database() as conn:
        row = conn.execute("SELECT * FROM lexicon_entries WHERE lexicon_entry_id=?", (entry_id,)).fetchone()
        if not row:
            return fail("Spelling not found.", 404)
        conn.execute("UPDATE lexicon_entries SET status='retired',updated_at=datetime('now') WHERE lexicon_entry_id=?", (entry_id,))
        conn.execute("INSERT INTO lexicon_history(lexicon_entry_id,event_type,raw_value,accepted_value,reviewer_name,reason,reviewer_decision) VALUES(?,'retire_entry',?,'retired',?,'Retired from browser workspace','accept')", (entry_id, row["status"], who))
        return jsonify(retired=True)


@bp.get("/api/loans")
def loans():
    with database() as conn:
        return jsonify(loans=[dict(row) for row in conn.execute("SELECT l.*,r.title,r.archive_reference_canonical FROM item_loans l JOIN catalogue_records r USING(record_id) ORDER BY l.loan_id DESC")])


@bp.post("/api/records/<int:record_id>/loans")
def checkout(record_id):
    data = json_body()
    who = reviewer(data)
    borrower, destination, due = [text(data.get(f, ""), 200) for f in ["borrower", "destination", "due_date"]]
    if not all([borrower, destination, due]):
        return fail("Enter a borrower, destination and return date.")
    from datetime import date
    try:
        date.fromisoformat(due)
    except ValueError:
        return fail("Use a valid return date.")
    with database() as conn:
        row = conn.execute("SELECT * FROM catalogue_records WHERE record_id=?", (record_id,)).fetchone()
        if not row:
            return fail("Item not found.", 404)
        loan_id = conn.execute("INSERT INTO item_loans(record_id,borrower,destination,due_date,notes,previous_location) VALUES(?,?,?,?,?,?)", (record_id, borrower, destination, due, text(data.get("notes", "")), row["current_location"])).lastrowid
        conn.execute("UPDATE catalogue_records SET current_location=?,current_location_date=date('now'),updated_at=datetime('now') WHERE record_id=?", (destination, record_id))
        conn.execute("INSERT OR IGNORE INTO record_details(record_id) VALUES(?)", (record_id,))
        conn.execute("UPDATE record_details SET revision=revision+1 WHERE record_id=?", (record_id,))
        audit(conn, record_id, "manual_edit", "current_location", row["current_location"], destination, who, "Loan to " + borrower + "; due " + due)
        return jsonify(loan_id=loan_id), 201


@bp.post("/api/loans/<int:loan_id>/return")
def return_loan(loan_id):
    who = reviewer(json_body())
    with database() as conn:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute("SELECT * FROM item_loans WHERE loan_id=? AND returned_at IS NULL", (loan_id,)).fetchone()
        if not row:
            return fail("This loan is already returned or does not exist.", 409)
        conn.execute("UPDATE item_loans SET returned_at=datetime('now') WHERE loan_id=?", (loan_id,))
        conn.execute("UPDATE catalogue_records SET current_location=?,current_location_date=date('now'),updated_at=datetime('now') WHERE record_id=?", (row["previous_location"], row["record_id"]))
        conn.execute("UPDATE record_details SET revision=revision+1 WHERE record_id=?", (row["record_id"],))
        audit(conn, row["record_id"], "manual_edit", "current_location", row["destination"], row["previous_location"], who, "Loan returned and previous location restored.")
        return jsonify(returned=True)


@bp.get("/api/export")
def export_collection():
    with database() as conn:
        payload = {"synthetic_demo": is_demo(conn), "scope": "Internal catalogue export; includes donor and location fields.", "records": [serialise_record(row) for row in conn.execute(RECORD_QUERY + " ORDER BY r.record_id")]}
    response = jsonify(payload)
    response.headers["Content-Disposition"] = 'attachment; filename="collingham-catalogue.json"'
    return response


@bp.get("/api/demo/cards/<int:number>")
def demo_card(number):
    names = {1: "01-first-accession.pdf", 2: "02-later-accession.pdf"}
    if number not in names:
        return fail("Training card not found.", 404)
    return send_file(ROOT / "demo" / "cards" / names[number], as_attachment=True)


def init_workspace(app):
    app.config["MAX_CONTENT_LENGTH"] = 12 * 1024 * 1024
    app.config["UPLOAD_FOLDER"] = os.environ.get("COLLINGHAM_UPLOADS", str(Path(app.config["DATABASE_PATH"]).resolve().parent / "uploads"))
    app.extensions["scan_executor"] = ThreadPoolExecutor(max_workers=1, thread_name_prefix="archive-ocr")
    app.extensions["scan_slots"] = threading.BoundedSemaphore(3)
    # Only one application process should own a catalogue and its scanner queue.
    with connect(app.config["DATABASE_PATH"]) as conn:
        conn.execute("INSERT OR IGNORE INTO workspace_meta(key,value) VALUES('workspace_id',?)", (uuid.uuid4().hex,))
        conn.execute("UPDATE scan_jobs SET status='failed',error='Scanning was interrupted by a restart. The original is retained; upload it again.' WHERE status='processing'")
    app.register_blueprint(bp)

    @app.errorhandler(413)
    def too_large(_error):
        return fail("The upload is too large. Choose a file smaller than 12 MB.", 413)
