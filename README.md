# CDLHS Archive Digitisation

This repository contains the CDLHS archive digitisation work in two parts:

- a browser-based archive admin app in `project/`
- a local OCR ingestion toolchain in `PythonProjectDatabaseFeeder/`

The goal is to turn scanned archive cards into searchable records, let staff review OCR output in the browser, and save corrected data into the archive database.

## What it does

- reads archive card scans and PDFs
- extracts OCR text from each page
- presents OCR drafts for human review
- supports archive record creation, editing, search, and checkout tracking
- keeps the workflow local and charity-friendly, without requiring paid OCR APIs

## Project layout

- `project/` - browser app built with React, TypeScript, Vite, Tailwind, and `sql.js`
- `PythonProjectDatabaseFeeder/` - local OCR and feeder scripts for PDFs and card images
- `collingham_archive/` - Django-based archive model and CRUD work
- `PythonProjectDatabaseFeeder/card.png` - sample card image for OCR collaboration and testing

## Sample card

![Sample archive card](PythonProjectDatabaseFeeder/card.png)

## Browser app

The browser app is the main admin surface. It includes:

- card maintenance
- search
- checkout management
- OCR review

The OCR review screen shows the raw extracted text alongside editable archive fields so staff can correct OCR before saving.

## OCR workflow

The local OCR pipeline:

1. renders PDF pages to images
2. preprocesses each page
3. runs OCR using local tooling
4. writes draft output to JSON and CSV
5. loads OCR review data into the browser app for human correction

## Local setup

### Browser app

```bash
cd project
npm install
npm run build
npm run dev
```

### OCR feeder

```bash
cd PythonProjectDatabaseFeeder
python -m pip install -r requirements.txt
python cardreader.py
```

## Environment

The OCR scripts read local secrets and runtime settings from `PythonProjectDatabaseFeeder/.env`.

Important variables include:

- `OPENAI_API_KEY`
- `TESSERACT_CMD`
- `CARD_PDF_PATH`
- `OCR_OUTPUT_DIR`
- `OCR_ENGINE`
- `OCR_MANUAL_THRESHOLD`

## Notes

- The OCR output is draft quality for handwriting and must be reviewed before import.
- The app is browser-based and intended for administrative use.
- The repository currently favors local, no-cost tooling over paid API services.
