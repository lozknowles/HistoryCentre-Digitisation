# Archive workspace guide

Implemented and checked on 10 September 2026. The workspace is served at `/workspace/` by Flask after building `project/`. See the [root quick start](../README.md#start-the-browser-workspace).

## A card-shaped workspace

The digital front preserves simple object name, ID number, title, date received, description, donor, copyright, associated people/places and home/current locations. The reverse holds physical description, size, condition, notes and cross-references. The field arrangement follows the supplied card; mobile layouts stack narrow location fields for readability.

The collection has category filters, search, grid/list views, an item photograph gallery, review queue, remembered words, loans and change history. Every write requires the name of the person checking the item. Record edits reject stale versions; accession references are checked for case-insensitive duplicates.

## Accession by scanning

1. Enter the reviewer's name. Choose **Scan an archive card** and upload a PDF, PNG or JPEG, up to 12 MB and two pages.
2. Select the layout: the new landscape card, the recovered portrait card, or a general document. Place the card squarely in the image with the front first. The general-document option puts a transcription into the description for manual arrangement.
3. The local engine renders pixels and runs Tesseract. The original file is retained. Processing progress reports a real running job.
4. Compare each uncertain reading with the original. Enter the checked text and optionally remember that spelling. Review flagged names and archive references even when the engine reports high confidence.
5. Check both sides, classification and storage location. Add photographs of the actual object if needed. Confirm the complete card and accession it.

OCR confidence only helps prioritise review. Arbitrary uploads do not receive a claimed accuracy percentage. The portrait profile requires review of all non-empty fields; the old handwritten example remains difficult for Tesseract.

Interrupted jobs retain their source and become retryable failures after a restart. The scanner uses one worker and a bounded queue in one server process. It is not a distributed or durable background-job service.

## How remembered words improve later scans

A checked name or phrase can be stored with the exact variant read by OCR. Later scans match whole words/phrases against confirmed variants. A suggestion never overwrites raw OCR and still needs a human decision. Ambiguous variants are skipped, conflicting assignments are rejected, and archive references are excluded from learned substitution. Matches do not cascade into more replacements.

The remembered-words screen shows confirmed terms, observed variants and provenance, and allows retirement. History is retained. This is a correction dictionary, not neural-model training, and cannot guarantee future readings.

## Photograph before accession

Both scanning and manual entry provide **Take item photo** and **Choose photos**. The camera control requests the environment-facing camera through the browser's native file input. Browser support varies; the gallery/file option is available alongside it. See [MDN's capture reference](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture).

Photos upload into a staging area, show a preview and can be removed or replaced before accession. Uploading a photo does not create a catalogue record. Up to 12 JPEG, PNG or WebP images can attach to an item, each under 12 MB and 30 megapixels. A refresh can recover the manual card and staged photo IDs within the same browser tab/session and workspace. Accession is disabled during upload.

Original image bytes and their SHA-256 are retained. Previews honour EXIF orientation and omit EXIF metadata. Accession attaches staged images transactionally to the new record. Originals and previews can then be opened from the item. An image assigned to another record cannot be reused by its staging ID. Unattached uploads are retained until a future explicit housekeeping operation; removing a preview does not silently delete originals.

The browser journey verified a 390 x 844 viewport, camera-input configuration, synthetic image upload, preview/removal, draft recovery and attachment. **A physical phone camera has not been tested.** The appended mobile video uses a browser viewport and a supplied fictional image. The default loopback server is not reachable from a separate phone; a shared installation must provide an appropriate reachable address and access controls.

## Manual entry, loans and export

Manual accession uses the same card fields and confirmation as scanning. Required fields are object name, title and reference; retain uncertainty in descriptive notes. A physical object can be photographed without having an existing card.

A loan updates current location and appends audit history. A record cannot have two open loans. Returning it restores its previous location. Export contains internal catalogue fields, including donors and locations; it is not the curated public export from the original project and omits the complete media and audit database.

## Synthetic collection and media

The [100-record JSON](../catalogue/demo/collection.json) has ten records each for photographs, clothing/textiles, books/albums, helmets/uniform, bottles/medicine, deeds/documents, maps/plans, brochures/ephemera, domestic objects and tools/trade. IDs are `DEMO/2026/001` through `100`. Every record is sample data; dates, people and provenance are invented.

The [two PDF cards](../catalogue/demo/cards/) are additional accession exercises numbered 101 and 103. The manual bottle is 102. Its [AI-generated photo and prompt](../catalogue/demo/item-photos/PROVENANCE.md) are clearly fictional. Collection thumbnails are ten reusable category illustrations, not 100 purported photographs of historic holdings.

To regenerate the synthetic JSON and PDFs, install `reportlab>=4,<5` and run `python catalogue/scripts/generate_demo_collection.py --cards`. The generator also rewrites the exact-file benchmark hashes. Without `--cards`, it only regenerates JSON. Review regenerated cards visually and rerun real OCR checks before accepting changed fixtures.

## Configuration and existing records

| Setting | Purpose |
| --- | --- |
| `COLLINGHAM_DB` | Absolute SQLite path. Default: `catalogue/data/collingham-archive-catalogue.sqlite`. |
| `COLLINGHAM_UPLOADS` | Upload root; defaults to `uploads` beside the selected database. |
| `COLLINGHAM_HOST`, `COLLINGHAM_PORT` | Defaults: `127.0.0.1`, `8000`. |
| `TESSERACT_PATH`, `PDFTOPPM_PATH` | Optional executable paths when unavailable on PATH. |

For development, `npm run dev` serves React with `/api` proxied to `127.0.0.1:8000`. Flask serves the production build from `project/dist`. Schema additions are additive; back up an existing real database and its media before upgrading.

The recovered Flask pages still share the catalogue. **Earlier browser records** opens the earlier app; its `archiveDb` local storage remains untouched. Browser storage is tied to the origin, so records at an earlier host/port remain at that origin and need deliberate migration. The feeder and Django stores also remain separate.

## Verification

The isolated Linux installation used Tesseract 5.3.4, Playwright 1.63.0 and Chromium 153.0.8010.12. The backend suite passed **22 tests**, including two real optical scans, raw OCR retention, correction reuse, photograph staging/attachment, EXIF orientation, original-byte hashes, loan constraints and stale-edit protection. Windows passed 21 tests with the real-OCR test skipped because native Tesseract was absent. TypeScript checking and the production build passed.

The full browser journey passed 13 workflow checks with no page JavaScript errors. It started with 100 fictional records and no remembered variants; it ended with 103 records, one remembered variant, no unresolved scans and no open loans. The separate mobile draft did not increase the accession count. The earlier browser database was loaded and its stored value preserved.

The preserved portrait card also passed a read-only pipeline sanity check: two pages rendered, 103 OCR words across 17 non-empty fields, all flagged for human review. Its original SHA-256 remained unchanged. No accuracy score was assigned and no database was used for that check.

| Fixture | Raw optical result | After review / dictionary | Measurement |
| --- | --- | --- | --- |
| First deed card | 97.94% | 100% after review | 2 word errors / 97 reference words |
| Later brochure card | 97.92% | 100% with two dictionary suggestions, before approval | 2 word errors / 96 reference words |

Both raw scans read the fictional name as `Helena Quillrere`; the checked spelling is `Helena Quillmere`. Accuracy is `100 × (1 − word edit distance / reference word count)`, summed per field and bounded at zero. Case and punctuation are ignored. Scores appear only when the uploaded SHA-256 matches a known synthetic fixture. Gold text is used by scoring after OCR, never by the recogniser. The scripted demonstration acts as the named fictional reviewer using known fixture text; it is not an independent human annotation study.

[Verification evidence](demo/verification.json) · [1440p MP4](demo/collingham-archive-walkthrough-1440p.mp4) · [Captions](demo/collingham-archive-walkthrough.srt)

To reproduce, start the server against a newly created 100-item demo database, then in `project/`:

```bash
npm ci
npx playwright install chromium
npm run verify:workspace
```

`ARCHIVE_URL` changes the default `http://127.0.0.1:8000`. `ARCHIVE_EVIDENCE` selects an evidence directory. The script refuses non-synthetic, already-accessioned or pre-learned data. `RECORD_DEMO=1` records an uncut 2560 x 1440 desktop video at normal speed. On the same synthetic server, `node scripts/record-mobile.cjs` adds a mobile draft recording without accession. Set environment variables using `$env:NAME = 'value'` in PowerShell or `export NAME=value` in a POSIX shell.

With FFmpeg/FFprobe on PATH, run `python scripts/render-demo.py PATH_TO_EVIDENCE --output NEW_OUTPUT_DIRECTORY` from `project/`. The renderer keeps the complete desktop recording, places captions below the application and appends the optional mobile scene. It refuses to overwrite existing videos. There is no audio narration.

For raw OCR measurement without a browser: `python catalogue/scripts/benchmark_scan.py --out NEW_SCRATCH_DIRECTORY`. Tests must use temporary databases. The historical GPU experiment is preserved, not invoked by these checks. No production database, original source checkout, public service or physical device was changed during this delivery.
