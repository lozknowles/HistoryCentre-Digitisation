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
- Browser type checking: `cd project && npm run typecheck`.
- The `/workspace/` React app uses the catalogue API and SQLite. Preserve the earlier browser app and its `archiveDb` local storage at `/workspace/#/legacy`.
- `project/scripts/verify-workspace.cjs` performs real optical scans and UI writes. Run only against a NEW synthetic 100-record database created by `catalogue/scripts/create_demo_database.py`.
- Keep raw OCR, suggested spellings, human decisions and measured fixture accuracy distinct. Never use benchmark gold text in the recogniser or claim fixture results as general handwriting accuracy.
- Stage item photographs before accession; preserve originals and human confirmation. A browser viewport or capture-input test does not qualify a physical phone camera.
- The public site has a separate entrypoint (`catalogue/run_public.py`) and build (`npm run build:public`). Do not register the internal workspace/API routes on that public process.
- Publish only explicitly reviewed public fields. Never expose donor/contact details, storage locations, raw OCR or original uploads through the public catalogue. Demo auto-publication is restricted to the explicitly synthetic database and runs once.
- Public form checks must use a fresh fictional database. Offer photographs and enquiry contact details belong outside the web root and require a staff session.
- The requested public URL is `https://lozknowles.com/cdlhs/index.html`. Do not add links to the existing lozknowles.com navigation or rebuild its unrelated website source.
- OCR feeder: `cd PythonProjectDatabaseFeeder && python cardreader.py`

## Commit expectations

- Keep commits aligned to one visible piece of work when possible.
- Verify the browser app still builds before committing frontend changes.
- If OCR pipeline changes, sanity-check the sample PDF path and output files.

## Data caution

This repository contains archive material, scanned PDFs, and supporting documents.
Treat those files as project data, not disposable test fixtures.
