# AGENTS.md

This repository is a working archive digitisation system for CDLHS.

## Working rules

- Prefer small, focused changes.
- Keep the browser app usable in the browser first; do not turn it into a demo shell.
- Keep OCR output editable by a human before it is treated as live archive data.
- Avoid paid external services unless the user explicitly asks for them.
- Do not expose secrets in source files.
- Do not delete user work unless explicitly asked.

## Main areas

- `catalogue/` is the recovered Flask/SQLite catalogue review app and name lexicon. See `catalogue/UPSTREAM.md` and `docs/recovered-ocr-work.md` for provenance.
- `project/` is the browser admin application.
- `PythonProjectDatabaseFeeder/` is the local OCR and ingestion toolchain.
- `collingham_archive/` contains the Django archive model and CRUD code.

## Build and test

- Catalogue review app: `cd catalogue && python -m pip install -r requirements-dev.txt && python -m pytest`
- Catalogue tests must use temporary databases. Do not run write checks against an existing archivist database.
- `catalogue/poc/` preserves historical OCR evidence. Do not collect its model experiment as an ordinary test or run GPU inference as part of review-app checks.
- Browser app: `cd project && npm run build`
- OCR feeder: `cd PythonProjectDatabaseFeeder && python cardreader.py`

## Commit expectations

- Keep commits aligned to one visible piece of work when possible.
- Verify the browser app still builds before committing frontend changes.
- If OCR pipeline changes, sanity-check the sample PDF path and output files.

## Data caution

This repository contains archive material, scanned PDFs, and supporting documents.
Treat those files as project data, not disposable test fixtures.
