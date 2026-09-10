# Fictional archive training collection

`collection.json` contains exactly 100 invented Collingham archive records in ten categories. These are not actual holdings, donors or historical claims. References use the `DEMO/2026/` namespace and every record is sample data.

Create an isolated SQLite database with `python catalogue/scripts/create_demo_database.py --db catalogue/runtime/demo.sqlite` from the repository root. Existing files are never overwritten. Select the database with `COLLINGHAM_DB` before starting the app.

`cards/01-first-accession.pdf` and `cards/02-later-accession.pdf` are two-sided synthetic cards for accessions 101 and 103. Their cursive name uses the included [Homemade Apple font](fonts/README.md). This is typeset handwriting. `benchmark.json` binds exact SHA-256 values to expected fields for scoring only.

The bottle photograph is AI-generated; its [provenance and full prompt](item-photos/PROVENANCE.md) are supplied. Other thumbnails are category illustrations drawn in the browser.

The [workspace guide](../../docs/card-workspace.md) explains the exercise, verification, limitations and filmed walkthrough. Never mix these records into a real catalogue as factual archive data.
