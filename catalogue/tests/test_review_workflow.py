import sqlite3

import pytest

from app.web import create_app


@pytest.fixture
def review_app():
    app = create_app()
    app.config["TESTING"] = True
    app.test_client().get("/records")
    return app


def query(app, sql):
    with sqlite3.connect(app.config["DATABASE_PATH"]) as conn:
        return conn.execute(sql).fetchall()


def test_pielichaty_correction_keeps_original_ocr_and_sample_status(review_app):
    assert query(review_app, "SELECT donated_by, is_sample FROM catalogue_records") == [("H PIELICHATY", 1)]
    assert query(review_app, "SELECT raw_value, accepted_value FROM catalogue_record_history WHERE field_name = 'donated_by'") == [
        ("H PIEU CHATY", "H PIELICHATY")
    ]
    assert query(review_app, "SELECT e.canonical_text, v.variant_text FROM lexicon_entries e JOIN lexicon_variants v USING (lexicon_entry_id)") == [
        ("PIELICHATY", "PIEU CHATY")
    ]


@pytest.mark.parametrize("decision,reviewed_value,expected", [
    ("accept", "", "EF/AA/JOH/7"),
    ("correct", "EF/AA/JOH/TEST", "EF/AA/JOH/TEST"),
    ("reject", "", "EF/AA/JOH/7"),
])
def test_review_preserves_raw_history_and_resolves_queue(review_app, decision, reviewed_value, expected):
    client = review_app.test_client()
    original = query(review_app, "SELECT * FROM catalogue_record_history WHERE history_id = 1")
    response = client.post("/review-queue/1", data={
        "decision": decision,
        "reviewed_value": reviewed_value,
        "reviewer_name": "Test archivist",
        "reason": "Review workflow regression",
    })
    assert response.status_code == 302
    assert query(review_app, "SELECT archive_reference_canonical FROM catalogue_records") == [(expected,)]
    assert query(review_app, "SELECT * FROM catalogue_record_history WHERE history_id = 1") == original
    assert query(review_app, "SELECT COUNT(*) FROM catalogue_record_history") == [(3,)]
    assert query(review_app, "SELECT decision FROM catalogue_history_decisions") == [(decision,)]
    assert b"No pending items." in client.get("/review-queue").data
    records_page = client.get("/records").get_data(as_text=True)
    assert "Queue items: 0." in records_page


def test_confirmed_lexicon_entry_and_variant_are_audited(review_app):
    client = review_app.test_client()
    assert client.post("/lexicon/entries", data={
        "canonical_text": "TEST SURNAME",
        "entry_type": "surname",
        "reviewer_name": "Test archivist",
        "source_reference": "Synthetic regression fixture",
    }).status_code == 302
    assert client.post("/lexicon/variants", data={
        "lexicon_entry_id": "2",
        "variant_text": "TEST OCR VARIANT",
        "variant_type": "ocr_variant",
        "confidence": "0.9",
        "reviewer_name": "Test archivist",
    }).status_code == 302
    assert query(review_app, "SELECT event_type, reviewer_name FROM lexicon_history ORDER BY lexicon_history_id") == [
        ("create_entry", "Test archivist"),
        ("create_variant", "Test archivist"),
    ]
    with sqlite3.connect(review_app.config["DATABASE_PATH"]) as conn:
        assert conn.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
        assert conn.execute("PRAGMA foreign_key_check").fetchall() == []
    assert b"TEST OCR VARIANT" in client.get("/lexicon").data
