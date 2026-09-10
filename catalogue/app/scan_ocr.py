"""Local optical OCR with explicit correction suggestions and measured fixtures.

No network inference, embedded PDF text extraction, or access to gold answers in
the recogniser. Exact synthetic-file scoring happens separately, after OCR.
"""

from __future__ import annotations

import csv
import io
import json
import os
import re
import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageOps

from .card_layout import CARD_FIELDS, CELLS, HEIGHT, HISTORIC_BOXES, WIDTH, value_box

ROOT = Path(__file__).resolve().parents[1]
Image.MAX_IMAGE_PIXELS = 30_000_000


def executable(name):
    configured = os.environ.get(name.upper() + "_PATH")
    return shutil.which(configured or name)


def capabilities():
    return {"tesseract": bool(executable("tesseract")), "pdf": bool(executable("pdftoppm"))}


def render_pages(source: Path, folder: Path):
    folder.mkdir(exist_ok=True, parents=True)
    if source.suffix.lower() == ".pdf":
        renderer = executable("pdftoppm")
        if not renderer:
            raise ValueError("PDF scanning needs Poppler (pdftoppm). Upload a PNG or JPEG, or install Poppler.")
        # Render one extra page to reject, rather than silently truncate, long PDFs.
        subprocess.run([renderer, "-r", "180", "-f", "1", "-l", "3", "-scale-to", "3000", "-png", str(source), str(folder / "page")],
                       capture_output=True, timeout=60, check=True)
        pages = sorted(folder.glob("page-*.png"))
        if len(pages) > 2:
            raise ValueError("Upload one card at a time (at most two pages). Split longer PDFs before scanning.")
    else:
        with Image.open(source) as original:
            im = ImageOps.exif_transpose(original).convert("RGB")
            im.thumbnail((3000, 3000))
            im.save(folder / "page-1.png")
        pages = [folder / "page-1.png"]
    if not pages:
        raise ValueError("No readable pages were found in this file.")
    # Stable public preview names, independent of PDF page number padding.
    for index, path in enumerate(pages):
        shutil.copyfile(path, folder / f"preview-{index + 1}.png")
    return pages


def recognise(image_path, psm=6):
    command = executable("tesseract")
    if not command:
        raise ValueError("Scanning needs Tesseract with English language data. Manual accession is available.")
    result = subprocess.run([command, str(image_path), "stdout", "-l", "eng", "--psm", str(psm), "tsv"],
                            capture_output=True, text=True, encoding="utf-8", timeout=45, check=True)
    rows = []
    for row in csv.DictReader(io.StringIO(result.stdout), delimiter="\t", quoting=csv.QUOTE_NONE):
        if row.get("level") == "5" and (row.get("text") or "").strip():
            rows.append({"text": row["text"].strip(), "confidence": round(float(row["conf"]), 2),
                         "left": int(row["left"]), "top": int(row["top"]), "width": int(row["width"]), "height": int(row["height"]),
                         "line": ":".join(row[k] for k in ["block_num", "par_num", "line_num"])})
    lines = {}
    for row in rows:
        lines.setdefault(row["line"], []).append(row["text"])
    return "\n".join(" ".join(line) for line in lines.values()), rows


def extract(source: Path, folder: Path, profile="card"):
    pages = render_pages(source, folder)
    values, words = {key: "" for key in CARD_FIELDS}, []
    if profile == "document":
        texts = []
        for page, path in enumerate(pages):
            text, found = recognise(path, psm=3)
            texts.append(text)
            for word in found:
                word.update(field="brief_description", page=page)
            words.extend(found)
        values["brief_description"] = "\n\n".join(texts)
    else:
        for cell in CELLS:
            field, _, page, *_ = cell
            if profile == "historic" and field not in HISTORIC_BOXES:
                continue
            if page >= len(pages):
                continue
            with Image.open(pages[page]) as im:
                # The ruled card must fill the page, front first then back.
                if profile == "historic":
                    _, left, top, right, bottom = HISTORIC_BOXES[field]
                    sx, sy = im.width / 960, im.height / 1378
                else:
                    sx, sy = im.width / WIDTH, im.height / HEIGHT
                    left, top, right, bottom = value_box(cell)
                box = (round(left * sx), round(top * sy), round(right * sx), round(bottom * sy))
                region = im.crop(box).convert("RGB")
                if profile == "historic":
                    region = ImageOps.autocontrast(ImageOps.grayscale(region)).convert("RGB")
                crop = ImageOps.expand(region, border=20, fill="white")
                crop_path = folder / f"field-{field}.png"
                crop.save(crop_path)
            value, found = recognise(crop_path, psm=6)
            values[field] = value
            for word in found:
                word.update(field=field, page=page, left=word["left"] + box[0] - 20, top=word["top"] + box[1] - 20)
            words.extend(found)
    if not words:
        raise ValueError("No text was recognised. Try a sharper, upright scan or enter the card manually.")
    flagged = sorted({word["field"] for word in words if word["confidence"] < 85})
    # Names and references deserve review even when OCR reports high confidence.
    flagged = sorted(set(flagged) | {key for key in ["donated_by", "associated_people", "archive_reference_canonical"] if values.get(key)})
    if profile == "historic":
        flagged = [key for key, value in values.items() if value]
    return values, words, flagged, len(pages)


def apply_dictionary(fields, variants):
    """Suggest exact whole words/phrases only; ambiguous variants are skipped.

    Matches are made against raw text in one pass, so corrections cannot cascade.
    Catalogue references are excluded: their semantics need independent review.
    """
    choices = {}
    for variant in variants:
        raw = variant["variant_text"].strip()
        if not raw:
            continue
        choices.setdefault(raw.casefold(), {"raw": raw, "targets": set()})["targets"].add(variant["canonical_text"])
    known = {key: next(iter(v["targets"])) for key, v in choices.items() if len(v["targets"]) == 1}
    if not known:
        return dict(fields), []
    pattern = re.compile(r"(?<!\w)(?:" + "|".join(re.escape(choices[key]["raw"]) for key in sorted(known, key=len, reverse=True)) + r")(?!\w)", re.IGNORECASE)
    suggestions, draft = [], dict(fields)
    for field, raw_text in fields.items():
        if field == "archive_reference_canonical":
            continue
        def replace(match):
            canonical = known[match.group().casefold()]
            if match.group() != canonical:
                suggestions.append({"field": field, "raw": match.group(), "suggested": canonical, "source": "human-confirmed dictionary", "start": match.start(), "end": match.end()})
            return canonical
        draft[field] = pattern.sub(replace, raw_text)
    return draft, suggestions


def normalise_words(value):
    return re.findall(r"\w+", value.casefold(), flags=re.UNICODE)


def edit_distance(expected, actual):
    previous = list(range(len(actual) + 1))
    for index, word in enumerate(expected, 1):
        current = [index]
        for col, other in enumerate(actual, 1):
            current.append(min(current[-1] + 1, previous[col] + 1, previous[col - 1] + (word != other)))
        previous = current
    return previous[-1]


def score_fields(expected, actual):
    errors, total = 0, 0
    for field, text in expected.items():
        gold = normalise_words(text)
        errors += edit_distance(gold, normalise_words(actual.get(field, "")))
        total += len(gold)
    return {"word_accuracy": round(max(0, 1 - errors / max(1, total)) * 100, 2), "word_errors": errors, "reference_words": total}


def benchmark_score(checksum, raw, draft):
    manifest = json.loads((ROOT / "demo" / "benchmark.json").read_text(encoding="utf-8"))
    fixture = next((f for f in manifest["fixtures"] if f["sha256"] == checksum), None)
    if not fixture:
        return None
    return {"scope": "Exact synthetic fixture only; case and punctuation normalised. Not a real-archive accuracy claim.",
            "fixture": fixture["file"], "raw": score_fields(fixture["expected_fields"], raw),
            "draft": score_fields(fixture["expected_fields"], draft)}
