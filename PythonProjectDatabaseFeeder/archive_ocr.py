from __future__ import annotations

import csv
import json
import os
import re
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

import fitz  # PyMuPDF
import numpy as np
import pytesseract
from PIL import Image, ImageEnhance, ImageFilter

try:
    import easyocr  # type: ignore
except Exception:
    easyocr = None


FIELD_PATTERNS: Dict[str, Sequence[str]] = {
    "simple_object_name": [
        r"(?:simple object name|object name|simple object):\s*(.+)",
    ],
    "id_number": [
        r"(?:id number|id no\.?|accession number):\s*(.+)",
    ],
    "title": [
        r"(?:title):\s*(.+)",
    ],
    "date_received": [
        r"(?:date received|received):\s*(.+)",
    ],
    "brief_description": [
        r"(?:brief description|description):\s*(.+)",
    ],
    "donated_loan_by": [
        r"(?:donated/loan by|donated by|loan by):\s*(.+)",
    ],
    "donation_date": [
        r"(?:date \(donation/loan\)|date \(donated/loan\)|donation date|loan date):\s*(.+)",
    ],
    "copyright": [
        r"(?:copyright):\s*(.+)",
    ],
    "associated_people": [
        r"(?:associated people|people):\s*(.+)",
    ],
    "associated_places": [
        r"(?:associated places|places):\s*(.+)",
    ],
    "home_location": [
        r"(?:home location):\s*(.+)",
    ],
    "home_location_date": [
        r"(?:date \(home location\)):?\s*(.+)",
    ],
    "current_location": [
        r"(?:current location):\s*(.+)",
    ],
    "current_location_date": [
        r"(?:date \(current location\)):?\s*(.+)",
    ],
    "physical_description": [
        r"(?:physical description|physical desc(?:ription)?):\s*(.+)",
    ],
    "size": [
        r"(?:size):\s*(.+)",
    ],
    "condition": [
        r"(?:condition):\s*(.+)",
    ],
    "notes": [
        r"(?:notes|cross references?|cross-reference[s]?):\s*(.+)",
    ],
}

FIELD_LABEL_PATTERNS: Dict[str, Sequence[str]] = {
    "simple_object_name": [r"(?:simple object name|simple object|object name)"],
    "id_number": [r"(?:id number|id no\.?|accession number)"],
    "title": [r"(?:title)"],
    "date_received": [r"(?:date received|received)"],
    "brief_description": [r"(?:brief description|description)"],
    "donated_loan_by": [r"(?:donated/loan by|donated by|loan by)"],
    "donation_date": [r"(?:date \(donation/loan\)|date \(donated/loan\)|donation date|loan date)"],
    "copyright": [r"(?:copyright)"],
    "associated_people": [r"(?:associated people|people)"],
    "associated_places": [r"(?:associated places|places)"],
    "home_location": [r"(?:home location)"],
    "home_location_date": [r"(?:date \(home location\))"],
    "current_location": [r"(?:current location)"],
    "current_location_date": [r"(?:date \(current location\))"],
    "physical_description": [r"(?:physical description|physical desc(?:ription)?)"],
    "size": [r"(?:size)"],
    "condition": [r"(?:condition)"],
    "notes": [r"(?:notes|cross references?|cross-reference[s]?)"],
}


@dataclass
class OCRPageResult:
    page_number: int
    engine: str
    confidence: float
    raw_text: str
    manual_review: bool


@dataclass
class OCRDocumentResult:
    source_pdf: str
    engine: str
    pages: List[OCRPageResult]
    fields: Dict[str, str]
    manual_review: bool


def load_env_file(env_path: Path) -> None:
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def ensure_tesseract() -> None:
    tesseract_cmd = os.getenv("TESSERACT_CMD", r"C:\Program Files\Tesseract-OCR\tesseract.exe")
    if not Path(tesseract_cmd).exists():
        raise RuntimeError(
            f"Tesseract not found at {tesseract_cmd}. Set TESSERACT_CMD in .env."
        )
    pytesseract.pytesseract.tesseract_cmd = tesseract_cmd


def preprocess_image(image: Image.Image) -> Image.Image:
    grayscale = image.convert("L")
    grayscale = ImageEnhance.Contrast(grayscale).enhance(2.0)
    grayscale = grayscale.filter(ImageFilter.SHARPEN)
    return grayscale


def render_pdf_pages(pdf_path: Path, zoom: float = 2.5) -> List[Image.Image]:
    document = fitz.open(pdf_path)
    pages: List[Image.Image] = []
    matrix = fitz.Matrix(zoom, zoom)
    for page_index in range(len(document)):
        page = document.load_page(page_index)
        pixmap = page.get_pixmap(matrix=matrix, alpha=False)
        pages.append(Image.frombytes("RGB", [pixmap.width, pixmap.height], pixmap.samples))
    return pages


def _easyocr_reader():
    if easyocr is None:
        return None
    cache = getattr(_easyocr_reader, "_cache", None)
    if cache is None:
        temp_root = Path(os.getenv("TEMP", str(Path.home() / "AppData" / "Local" / "Temp"))) / "cdlhs_easyocr"
        model_dir = Path(os.getenv("EASYOCR_MODEL_DIR", str(temp_root / "models")))
        user_network_dir = Path(os.getenv("EASYOCR_USER_NETWORK_DIR", str(temp_root / "user_network")))
        model_dir.mkdir(parents=True, exist_ok=True)
        user_network_dir.mkdir(parents=True, exist_ok=True)
        cache = easyocr.Reader(
            ["en"],
            gpu=False,
            model_storage_directory=str(model_dir),
            user_network_directory=str(user_network_dir),
            download_enabled=True,
            verbose=False,
        )
        setattr(_easyocr_reader, "_cache", cache)
    return cache


def ocr_with_easyocr(image: Image.Image) -> Tuple[Optional[str], float]:
    reader = _easyocr_reader()
    if reader is None:
        return None, 0.0
    results = reader.readtext(np.array(image), detail=0, paragraph=True)
    text = " ".join(part.strip() for part in results if isinstance(part, str)).strip()
    confidence = 0.0
    if results:
        try:
            detailed = reader.readtext(np.array(image), detail=1, paragraph=True)
            confs = [float(item[2]) for item in detailed if len(item) >= 3]
            confidence = round(sum(confs) / len(confs) * 100 if confs and max(confs) <= 1 else sum(confs) / len(confs), 2) if confs else 0.0
        except Exception:
            confidence = 0.0
    return (text or None), confidence


def average_confidence(image: Image.Image, config: str) -> float:
    data = pytesseract.image_to_data(image, config=config, output_type=pytesseract.Output.DICT)
    confidences: List[float] = []
    for conf in data.get("conf", []):
        try:
            value = float(conf)
        except (TypeError, ValueError):
            continue
        if value >= 0:
            confidences.append(value)
    return round(sum(confidences) / len(confidences), 2) if confidences else 0.0


def ocr_with_tesseract(image: Image.Image) -> Tuple[str, float]:
    configs = [
        "--oem 3 --psm 6",
        "--oem 3 --psm 11",
        "--oem 3 --psm 4",
    ]
    best_text = ""
    best_confidence = -1.0
    for config in configs:
        text = pytesseract.image_to_string(image, config=config)
        confidence = average_confidence(image, config=config)
        if confidence > best_confidence or (confidence == best_confidence and len(text) > len(best_text)):
            best_text = text
            best_confidence = confidence
    return best_text.strip(), max(best_confidence, 0.0)


def ocr_page(image: Image.Image, engine: str) -> Tuple[str, float]:
    prepared = preprocess_image(image)
    if engine in {"easyocr", "hybrid"}:
        easyocr_text, easyocr_confidence = ocr_with_easyocr(prepared)
        if engine == "easyocr":
            return easyocr_text or "", easyocr_confidence
        tesseract_text, tesseract_confidence = ocr_with_tesseract(prepared)
        if easyocr_text and easyocr_confidence >= tesseract_confidence:
            return easyocr_text, easyocr_confidence
        if tesseract_text:
            return tesseract_text, tesseract_confidence
        if easyocr_text:
            return easyocr_text, easyocr_confidence
            return "", 0.0
    return ocr_with_tesseract(prepared)


def _normalize_lines(text: str) -> str:
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines()]
    return "\n".join(line for line in lines if line)


def extract_fields(text: str) -> Dict[str, str]:
    normalized = _normalize_lines(text)
    fields = {key: "" for key in FIELD_PATTERNS}

    spans: List[Tuple[int, int, str]] = []
    for key, patterns in FIELD_LABEL_PATTERNS.items():
        for pattern in patterns:
            match = re.search(pattern, normalized, flags=re.IGNORECASE | re.MULTILINE)
            if match:
                spans.append((match.start(), match.end(), key))
                break

    spans.sort(key=lambda item: item[0])

    for index, (_, end, key) in enumerate(spans):
        next_start = spans[index + 1][0] if index + 1 < len(spans) else len(normalized)
        value = normalized[end:next_start].strip(" :-")
        value = re.sub(r"\s+", " ", value).strip()
        if value:
            fields[key] = value

    for key, patterns in FIELD_PATTERNS.items():
        if fields[key]:
            continue
        for pattern in patterns:
            match = re.search(pattern, normalized, flags=re.IGNORECASE | re.MULTILINE)
            if match:
                fields[key] = match.group(1).strip()
                break

    return fields


def field_aliases_for_export(fields: Dict[str, str]) -> Dict[str, str]:
    return {
        "Simple object name": fields["simple_object_name"],
        "ID number": fields["id_number"],
        "Title": fields["title"],
        "Date received": fields["date_received"],
        "Brief description": fields["brief_description"],
        "Donated/loan by": fields["donated_loan_by"],
        "Date (Donation/loan)": fields["donation_date"],
        "Copyright": fields["copyright"],
        "Associated people": fields["associated_people"],
        "Associated places": fields["associated_places"],
        "Home location": fields["home_location"],
        "Date (Home location)": fields["home_location_date"],
        "Current location": fields["current_location"],
        "Date (Current location)": fields["current_location_date"],
        "Physical description": fields["physical_description"],
        "Size": fields["size"],
        "Condition": fields["condition"],
        "Notes": fields["notes"],
    }


def required_field_gaps(fields: Dict[str, str]) -> List[str]:
    required = ["simple_object_name", "id_number", "title"]
    return [key for key in required if not fields.get(key)]


def process_pdf(pdf_path: Path, engine: str = "tesseract", manual_threshold: float = 60.0) -> OCRDocumentResult:
    pages = render_pdf_pages(pdf_path)
    page_results: List[OCRPageResult] = []
    page_texts: List[str] = []

    for index, page_image in enumerate(pages, start=1):
        text, confidence = ocr_page(page_image, engine)
        manual_review = confidence < manual_threshold or not text.strip()
        page_results.append(
            OCRPageResult(
                page_number=index,
                engine=engine,
                confidence=confidence,
                raw_text=text,
                manual_review=manual_review,
            )
        )
        page_texts.append(text)

    combined_text = "\n".join(page_texts)
    fields = extract_fields(combined_text)
    manual_review = any(page.manual_review for page in page_results) or bool(required_field_gaps(fields))

    return OCRDocumentResult(
        source_pdf=pdf_path.name,
        engine=engine,
        pages=page_results,
        fields=field_aliases_for_export(fields),
        manual_review=manual_review,
    )


def save_results(result: OCRDocumentResult, output_dir: Path) -> Tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)

    json_path = output_dir / f"{Path(result.source_pdf).stem}_ocr.json"
    csv_path = output_dir / f"{Path(result.source_pdf).stem}_ocr.csv"

    json_path.write_text(json.dumps(asdict(result), indent=2), encoding="utf-8")

    with csv_path.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(
            csv_file,
            fieldnames=["source_pdf", "engine", "manual_review", *result.fields.keys()],
        )
        writer.writeheader()
        writer.writerow(
            {
                "source_pdf": result.source_pdf,
                "engine": result.engine,
                "manual_review": result.manual_review,
                **result.fields,
            }
        )

    return json_path, csv_path
