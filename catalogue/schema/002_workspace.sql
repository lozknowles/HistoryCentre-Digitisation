-- Additive browser workspace migration; the recovered catalogue is retained.
CREATE TABLE IF NOT EXISTS workspace_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS record_details (
    record_id INTEGER PRIMARY KEY REFERENCES catalogue_records(record_id) ON DELETE CASCADE,
    category TEXT NOT NULL DEFAULT 'Uncategorised', era TEXT NOT NULL DEFAULT '',
    material TEXT NOT NULL DEFAULT '', accession_method TEXT NOT NULL DEFAULT 'existing',
    revision INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS scan_jobs (
    scan_id TEXT PRIMARY KEY, filename TEXT NOT NULL, source_path TEXT NOT NULL,
    checksum_sha256 TEXT NOT NULL, profile TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('processing','review','accepted','failed')),
    raw_fields_json TEXT NOT NULL DEFAULT '{}', draft_fields_json TEXT NOT NULL DEFAULT '{}',
    words_json TEXT NOT NULL DEFAULT '[]', suggestions_json TEXT NOT NULL DEFAULT '[]',
    reviewed_json TEXT NOT NULL DEFAULT '[]', flagged_json TEXT NOT NULL DEFAULT '[]',
    pages INTEGER NOT NULL DEFAULT 0, error TEXT, elapsed_seconds REAL,
    source_asset_id INTEGER REFERENCES source_assets(source_asset_id),
    ocr_run_id INTEGER REFERENCES ocr_runs(ocr_run_id),
    record_id INTEGER REFERENCES catalogue_records(record_id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS scan_reviews (
    review_id INTEGER PRIMARY KEY AUTOINCREMENT, scan_id TEXT NOT NULL REFERENCES scan_jobs(scan_id),
    field_name TEXT NOT NULL, raw_value TEXT NOT NULL, previous_value TEXT NOT NULL,
    accepted_value TEXT NOT NULL, remember INTEGER NOT NULL DEFAULT 0,
    reviewer_name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS item_loans (
    loan_id INTEGER PRIMARY KEY AUTOINCREMENT, record_id INTEGER NOT NULL REFERENCES catalogue_records(record_id),
    borrower TEXT NOT NULL, destination TEXT NOT NULL, due_date TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '',
    previous_location TEXT, checked_out_at TEXT NOT NULL DEFAULT (datetime('now')), returned_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS one_open_loan ON item_loans(record_id) WHERE returned_at IS NULL;
CREATE TABLE IF NOT EXISTS item_photos (
    photo_id TEXT PRIMARY KEY, record_id INTEGER REFERENCES catalogue_records(record_id),
    filename TEXT NOT NULL, original_path TEXT NOT NULL, preview_path TEXT NOT NULL,
    checksum_sha256 TEXT NOT NULL, mime_type TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
