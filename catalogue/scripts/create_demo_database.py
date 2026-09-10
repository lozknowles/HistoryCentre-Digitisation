"""Create a NEW, separate synthetic catalogue. Never overwrites an existing DB."""
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.workspace import DETAIL_FIELDS, record_values


def create_demo(path: Path):
    path = path.resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive creation makes accidental replacement impossible.
    with path.open("xb"):
        pass
    source = json.loads((ROOT / "demo" / "collection.json").read_text(encoding="utf-8"))
    assert source["synthetic"] and len(source["records"]) == 100
    with sqlite3.connect(path) as conn:
        conn.executescript((ROOT / "schema" / "001_initial.sql").read_text(encoding="utf-8"))
        conn.executescript((ROOT / "schema" / "002_workspace.sql").read_text(encoding="utf-8"))
        conn.execute("INSERT INTO workspace_meta VALUES('synthetic_demo','true')")
        for index, data in enumerate(source["records"], 1):
            values = record_values(data)
            values.update(record_slug=f"synthetic-{index:03}", is_sample=1)
            record_id = conn.execute(f"INSERT INTO catalogue_records ({','.join(values)}) VALUES ({','.join('?' for _ in values)})", tuple(values.values())).lastrowid
            conn.execute("INSERT INTO record_details(record_id,category,era,material,accession_method) VALUES(?,?,?,?,'synthetic seed')", (record_id, *[data[f] for f in DETAIL_FIELDS]))
            conn.execute("INSERT INTO catalogue_record_history(record_id,event_type,accepted_value,reviewer_decision,reviewer_name,reason) VALUES(?,'manual_edit',?,'info','Synthetic collection generator','Fictional training record; not a real accession.')", (record_id, data["title"]))
    print(f"Created 100 fictional items in {path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", type=Path, required=True)
    create_demo(parser.parse_args().db)
