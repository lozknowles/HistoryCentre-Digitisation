# Imported catalogue work

- Source: <https://github.com/lozknowles/collingham-archive-catalogue>
- Source branch: `main`
- Source commit: `5d512a647510562a285d49653c980f26723b2cad`
- Commit date: 4 July 2026, 18:30:22 +01:00
- Commit subject: Preserve suggested value when accepting blank review fields
- Imported into `HistoryCentre-Digitisation/catalogue/` on 10 September 2026.

All 41 source-tracked files were imported. `UPSTREAM.json` records their original Git blob IDs and modes. Original scans, OCR output, schema, seed records, model experiment, and historical project notes are preserved. The source repository remains independent.

Integration changes are limited to:

- Launching on `127.0.0.1` with debugging disabled, with explicit host/port environment options.
- Respecting `COLLINGHAM_DB` when the Linux launcher bootstraps a database.
- Counting unresolved review items consistently with the queue after a decision is recorded.
- Isolating tests in temporary databases and covering the name correction, blank-value acceptance, edited/rejected suggestions, and lexicon audit trail.
- Development dependencies, local runtime ignore rules, and consolidation documentation.

The running HPUbuntu database, model weights, virtual environments, and unrelated untracked enclosure-page preparation script were not imported. The confirmed surname/variant already exists in the source-controlled seed data. The 15 preserved runtime artifacts also present under `/fast/olmocr-poc` were compared by SHA-256 on 10 September and all matched.

GPU OCR was not rerun during consolidation. Recorded model settings and timings describe the July proof of concept, not a new hardware qualification.
