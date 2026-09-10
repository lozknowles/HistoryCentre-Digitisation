# collingham-archive-catalogue

This is the 4 July 2026 catalogue project, consolidated into HistoryCentre-Digitisation on 10 September 2026. See [UPSTREAM.md](UPSTREAM.md) for the exact source commit and integration changes, and [the main setup guide](../README.md#start-the-catalogue-review-app) for Windows and Linux instructions.

OCR-assisted digital catalogue for the Collingham and District Local History Society History Centre Archive.

This repository starts as a provenance-first foundation rather than a finished app. The immediate goal is to preserve the existing paper-card archive workflow, keep the original OCR proof of concept intact, and create a SQLite-backed catalogue that can be reviewed and corrected by archivists without losing audit history.

## Current shape

- SQLite is the canonical store for catalogue records and correction history.
- Original scans stay immutable and are referenced, not overwritten.
- OCR output is treated as draft evidence, not truth.
- Human review is first-class and append-only history is retained.
- Public exports are curated and exclude raw OCR/admin detail unless explicitly marked public.

## Working model

1. Scan the paper card or page.
2. Preserve the original scan asset.
3. Run local OCR using the proven P5000 workflow from `/fast/olmocr-poc`.
4. Store raw OCR, suggested values, and reviewed canonical values separately.
5. Validate archive references against locally documented catalogue-code rules.
6. Maintain a local lexicon of confirmed names, places, buildings, and catalogue terms.
7. Export only curated public fields for search and Ask Collingham-style answers.

## OCR proof of concept

The working OCR proof of concept lives in `/fast/olmocr-poc` and should be preserved as the baseline runtime reference.

Known working runtime:

- Model: `/fast/models/huggingface/olmOCR-2-7B-1025`
- GPU: NVIDIA Quadro P5000 16 GB
- Model path on Pascal hardware: float32 inference, not native bfloat16
- Framework: PyTorch 2.4.1+cu121
- Loader: `Transformers Qwen2_5_VLForConditionalGeneration`
- Memory profile: about 14 GiB GPU and about 48 GiB CPU
- Attention mode: eager
- Offload: CPU offload enabled

The proof of concept successfully transcribed a real two-page catalogue card and exposed two important requirements:

- archive reference validation must be rule-driven, not guessed
- human corrections must feed a local lexicon for later OCR batches

## Repository layout

- `app/` - Flask review app and Jinja templates
- `schema/` - SQLite schema and validation framework
- `seed/` - initial sample data and POC seed records
- `data/sample/` - human-readable sample records and exports
- `exports/sample/` - curated public export examples
- `poc/` - copied working OCR proof-of-concept files from `/fast/olmocr-poc`
- `scripts/` - local bootstrap helpers
- `tests/` - basic smoke checks

## Review app

This repository now includes a deliberately plain local web app for archivist review.

Screens:

- record list and search
- record detail
- edit reviewed fields
- correction review queue
- lexicon entries and variants

The app writes reviewed record changes to `catalogue_record_history` and lexicon maintenance actions to `lexicon_history`. Original scans and raw OCR files are left untouched.

## Local bootstrap

Create a local SQLite database from the schema and seed files:

```bash
python3 scripts/bootstrap_db.py
```

By default this writes `data/collingham-archive-catalogue.sqlite`, which is ignored by git.

## Run locally

```bash
scripts/run_local.sh
```

Run this from `catalogue/`. It creates a repo-local virtual environment in `.venv/`, installs Flask, bootstraps the database if needed, and starts the app on `http://127.0.0.1:8000`. The imported launcher uses loopback with debugging disabled. `COLLINGHAM_DB` selects a database, and `COLLINGHAM_PORT` selects a port. Network binding requires an explicit `COLLINGHAM_HOST` setting; this app has no authentication.

## Correction memory: current boundary

The `PIEU CHATY` to `PIELICHATY` correction is stored in the seeded lexicon. Archivists can add confirmed entries and variants, with audit records. The preserved OCR script does not yet query that lexicon, and no model fine-tuning has been performed. Automatic matching, batch ingestion, and application of these corrections to later OCR runs remain future work.

## Smoke check

```bash
.venv/bin/python scripts/check_routes.py
```

## Scope guardrails

- Do not auto-correct archive references without preserving the raw OCR value and a reason.
- Do not collapse raw OCR and canonical catalogue values into a single field.
- Do not place raw OCR or review notes into public exports by default.
- Do not fine-tune the OCR model at this stage.
