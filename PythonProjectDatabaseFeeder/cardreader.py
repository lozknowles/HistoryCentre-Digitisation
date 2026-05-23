from __future__ import annotations

import json
import os
from pathlib import Path

from archive_ocr import (
    load_env_file,
    process_pdf,
    save_results,
    ensure_tesseract,
)

__version__ = "2.0.0"


def main() -> int:
    base_dir = Path(__file__).resolve().parent
    load_env_file(base_dir / ".env")

    pdf_path = Path(os.getenv("CARD_PDF_PATH", str(base_dir / "card.pdf")))
    output_dir = Path(os.getenv("OCR_OUTPUT_DIR", str(base_dir / "output")))
    engine = os.getenv("OCR_ENGINE", "hybrid").strip().lower()
    manual_threshold = float(os.getenv("OCR_MANUAL_THRESHOLD", "60"))

    try:
        ensure_tesseract()
    except RuntimeError as exc:
        if engine == "tesseract":
            raise
        if engine == "hybrid":
            print(f"Tesseract unavailable, falling back to EasyOCR: {exc}")
            engine = "easyocr"

    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    print(f"CardReader version {__version__}")
    print(f"Processing {pdf_path.name} with engine={engine}")

    result = process_pdf(pdf_path, engine=engine, manual_threshold=manual_threshold)
    json_path, csv_path = save_results(result, output_dir)

    print(f"Saved JSON to {json_path}")
    print(f"Saved CSV to {csv_path}")
    print(f"Manual review required: {result.manual_review}")
    print(json.dumps(result.fields, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
