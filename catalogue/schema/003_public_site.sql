-- Public catalogue projection and private visitor enquiries. No existing record is published by this migration.
CREATE TABLE IF NOT EXISTS public_catalogue (
 public_id TEXT PRIMARY KEY, record_id INTEGER UNIQUE REFERENCES catalogue_records(record_id),
 reference TEXT NOT NULL UNIQUE, payload_json TEXT NOT NULL,
 published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0,1)),
 reviewed_by TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS public_enquiries (
 enquiry_id TEXT PRIMARY KEY, request_key TEXT NOT NULL UNIQUE, request_hash TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('visit','donation','loan')),
 reference TEXT NOT NULL UNIQUE, payload_json TEXT NOT NULL, photos_json TEXT NOT NULL DEFAULT '[]',
 status TEXT NOT NULL DEFAULT 'new', staff_notes TEXT NOT NULL DEFAULT '', revision INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_public_enquiries_status_created ON public_enquiries(status,created_at);
CREATE TABLE IF NOT EXISTS public_enquiry_history (
 event_id INTEGER PRIMARY KEY, enquiry_id TEXT NOT NULL REFERENCES public_enquiries(enquiry_id),
 previous_status TEXT NOT NULL, new_status TEXT NOT NULL, notes TEXT NOT NULL,
 reviewer TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS public_request_limits (
 bucket_key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
