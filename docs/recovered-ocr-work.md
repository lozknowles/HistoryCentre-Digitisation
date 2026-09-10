# Recovered archive-card OCR work

Verified on 10 September 2026.

## Where the work went

The original HistoryCentre-Digitisation repository stopped at commit `a7b7cba6d1a1ebd88204612c146f8d21f2364f8c` (13 June 2026). The later archive-card work continued on HPUbuntu in `/fast/olmocr-poc` and then [collingham-archive-catalogue](https://github.com/lozknowles/collingham-archive-catalogue).

The latest matching source commit is [5d512a647510562a285d49653c980f26723b2cad](https://github.com/lozknowles/collingham-archive-catalogue/commit/5d512a647510562a285d49653c980f26723b2cad), dated 4 July 2026. It includes the Flask review app and the fix that retains the suggested value when an archivist accepts a correction without typing a replacement.

The original task was named **Add OCR catalogue project**. Its working directory was `/fast/olmocr-poc`, and it explicitly brought the working OCR files into the catalogue repository.

## The Helena clue

The recovered example is the **David Johnson life-story card**. The donor and copyright fields contain an initial and surname, rather than the full first name:

| Field | Raw OCR | Reviewed value |
| --- | --- | --- |
| Donor/copyright | `H PIEU CHATY` | `H PIELICHATY` |
| Archive reference | `EF/AA/JOH/8` | `EF/AA/JOH/7` |

The remembered Helena correction corresponds to the `PIELICHATY` surname entry. The seed retains `PIEU CHATY` as an observed OCR variant. No new transcription or inferred expansion of the initial has been applied to the card.

Evidence:

- [Original two-page card](../catalogue/poc/card.pdf)
- [Raw OCR markdown](../catalogue/poc/output/card/card.md) and [JSON](../catalogue/poc/output/card/card.json)
- [Sample reviewed record](../catalogue/data/sample/david-johnson-card.json)
- [Seeded correction history and lexicon](../catalogue/seed/001_sample_data.sql)

## What is implemented

The catalogue stores source assets, OCR runs, raw values, suggested corrections, accepted values, reasons, reviewer decisions, and audit history. Archivists can search records, edit catalogue fields, accept/reject/edit suggestions, and add confirmed names and their variants to the lexicon. Public export examples contain curated fields. The imported card remains explicitly marked as sample data.

The learning mechanism currently consists of persisted human corrections and a maintained lexicon. The OCR script does not automatically consult that lexicon. Repeatable OCR-to-database ingestion, automatic matching against known variants, and broader batch validation remain planned work. No model fine-tuning is included.

The catalogue-code rule is deliberately pending authoritative source documentation. The sample correction must not be generalised into an invented rule for other archive references.

## Recovery checks

- The server checkout and GitHub catalogue source both identified commit `5d512a647510562a285d49653c980f26723b2cad`.
- All 15 preserved artifacts also present in the original OCR runtime matched by SHA-256, including the PDF, page images, OCR scripts, and transcripts.
- Read-only inspection of the existing server database found one catalogue record, one confirmed lexicon entry, and one OCR variant. The latest record-history entry was dated 4 July 2026. There was no additional learned-name list to recover from that database.
- The existing runtime database remains on HPUbuntu. This consolidation includes source-controlled sample data, not a copy of operational database state.
- The only untracked file in the source catalogue checkout was `scripts/prepare_enclosure_pages.py`, an unrelated enclosure-document preparation script; it remains there.
- The later `recovery/windows-2026-07/collingham-enclosure-pages` branch adds only that enclosure script (commit `231178d`), so it does not supersede the recovered card/lexicon work.

## Consolidation validation

- The initial import's `catalogue/` Git tree is identical to the source commit's tree, including all 41 file blobs and executable modes.
- The integration manifest identifies five adapted source files; the other 36 source files remain identical, including all original scans and OCR evidence.
- Six review tests pass against temporary databases, including the Pielichaty correction, accept/edit/reject decisions, immutable original history, resolved queue counts, lexicon audit writes, and SQLite integrity checks.
- The existing React app passes `npm run build`.
- The integration changes pass `git diff --check`. The separate verbatim source import retains its historical whitespace rather than rewriting preserved evidence.
- GPU OCR inference was not rerun, and no service deployment or operational database migration was performed.

## Consolidated layout

`catalogue/` contains the recovered app and its evidence. The earlier React app in `project/`, Django work in `collingham_archive/`, and feeder scripts in `PythonProjectDatabaseFeeder/` remain available. They are separate applications with separate stores; consolidation does not migrate or synchronise their records.

The app launcher now defaults to loopback without Flask debugging. Review-queue counts exclude resolved history items. Added regression tests use temporary SQLite databases and exercise the preserved correction behavior. See [UPSTREAM.md](../catalogue/UPSTREAM.md) for the exact integration changes.
