# Changelog

## 2026-09-10

- Consolidated the 4 July `collingham-archive-catalogue` work under `catalogue/`, from source commit `5d512a647510562a285d49653c980f26723b2cad`.
- Recovered the David Johnson sample card, raw olmOCR output, `PIEU CHATY` / `PIELICHATY` lexicon entry, SQLite schema, and review/audit app.
- Preserved the existing React, Django, and OCR feeder applications.
- Documented source provenance and the distinction between stored corrections and the future automatic OCR feedback loop.
- Made the imported launcher default to loopback with debugging disabled, added isolated review regression tests, and aligned pending counts with resolved review-queue items.

## Unreleased

- Added a browser-based OCR review screen for archive cards.
- Added a local OCR ingestion pipeline for scanned archive cards and PDFs.
- Moved OCR review data into the browser app so staff can correct drafts before saving.
- Added environment-based secret handling for OCR scripts.
- Added build and runtime fixes for the browser archive app.
- Added project documentation for setup, workflow, and maintenance.

## 2026-05-23

- Initial commit of the archive digitisation work.
- Established the browser archive app and the local OCR feeder workflow.
