"""Measure raw optical OCR on the two fictional card fixtures."""
import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.scan_ocr import benchmark_score, extract

parser = argparse.ArgumentParser()
parser.add_argument("--out", type=Path, required=True)
args = parser.parse_args()
args.out.mkdir(parents=True, exist_ok=True)
results = []
for source in sorted((ROOT / "demo" / "cards").glob("*.pdf")):
    raw, words, flagged, pages = extract(source, args.out / source.stem)
    result = {"file": source.name, "raw_fields": raw, "words": words, "flagged": flagged,
              "benchmark": benchmark_score(hashlib.sha256(source.read_bytes()).hexdigest(), raw, raw)}
    results.append(result)
    print(json.dumps({k: v for k, v in result.items() if k != "words"}, indent=2))
(args.out / "raw-ocr.json").write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
