"""Reproducible fictional collection. No real accession or donor data is used."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.card_layout import CELLS, HEIGHT, WIDTH, value_box

GROUPS = {
    "Photographs": [
        "Bicycles outside the village reading room", "Harvest tea beside the orchard", "Three sisters at a garden gate",
        "Flood water across a meadow lane", "The school allotment in spring", "A cobbler at his workbench",
        "Cricket tea under canvas", "The riverside ferry landing", "Village band rehearsal", "Winter walk to the station",
    ],
    "Clothing & textiles": [
        "Embroidered Sunday bonnet", "Linen dairy apron", "Child's knitted waistcoat", "Velvet evening gloves",
        "Patchwork cot cover", "Woollen railway scarf", "Lace wedding collar", "Cotton smock with horn buttons",
        "Home-sewn festival sash", "Mended gardener's jacket",
    ],
    "Books & albums": [
        "A gardener's weather notebook", "Household recipe book", "Village poetry album", "Arithmetic exercise book",
        "Orchard planting ledger", "Family photograph album", "Pocket bird guide", "Choir music book",
        "Carpenter's estimating notebook", "Subscription library register",
    ],
    "Helmets & uniform": [
        "Volunteer fire helmet", "Civil defence helmet", "Cyclist's leather cap", "Railway porter's cap",
        "Bandsman's peaked cap", "Stretcher party armband", "Fire brigade tunic badge", "Mechanic's workshop cap",
        "Volunteer steward's tabard", "School crossing patrol hat",
    ],
    "Bottles & medicine": [
        "Amber cough mixture bottle", "Blue glass ointment jar", "Stoppered chemist's bottle", "Ceramic eye-bath",
        "Green medicine measuring glass", "Paper-wrapped pill box", "Embossed liniment bottle", "Glass inhaler flask",
        "Apothecary balance weights", "Round lozenge tin",
    ],
    "Deeds & documents": [
        "Cottage conveyance on parchment", "Smallholding tenancy agreement", "Orchard sale particulars", "Workshop insurance policy",
        "Mill repair account", "Household inventory", "Garden boundary memorandum", "Signed apprenticeship indenture",
        "Village hall subscription list", "Mortgage discharge receipt",
    ],
    "Maps & plans": [
        "Hand-drawn orchard plan", "Field drainage sketch", "Cottage garden survey", "Schoolroom seating plan",
        "Footpath diversion sketch", "River meadow boundary map", "Workshop extension drawing", "Allotment plot plan",
        "Village walk route map", "Farm water supply plan",
    ],
    "Brochures & ephemera": [
        "Summer fete programme", "Village walking brochure", "Agricultural show handbill", "Amateur theatre programme",
        "Nursery plants catalogue", "Bicycle repair price list", "Harvest supper invitation", "Rail excursion leaflet",
        "Antique fair poster", "Church bazaar recipe leaflet",
    ],
    "Domestic objects": [
        "Enamel kitchen bread bin", "Wooden butter stamp", "Stoneware hot-water bottle", "Brass mantel candlestick",
        "Ceramic marmalade pot", "Tin biscuit cutter set", "Hand-cranked coffee mill", "Wicker sewing basket",
        "Brass front-door knocker", "Earthenware mixing bowl",
    ],
    "Tools & trade": [
        "Cooper's marking gauge", "Cobbler's wooden last", "Gardener's seed fiddle", "Carpenter's smoothing plane",
        "Blacksmith's small tongs", "Shopkeeper's brass scale", "Printer's composing stick", "Tailor's shears",
        "Thatcher's wooden leggett", "Wheelwright's spoke shave",
    ],
}
PEOPLE = ["Ada Brindlewick", "Edwin Quillmere", "Martha Fenwillow", "Jonah Mossheath", "Elsie Wrenford",
          "Walter Thistledene", "Nora Bellmarsh", "Albert Tansybrook", "Clara Rookstowe", "Frederick Willowby"]
PLACES = ["Imagined Willow Lane", "Imagined Ferry Meadow", "Imagined Orchard Cottage", "Imagined Mill Yard", "Imagined Wren House"]
MATERIALS = ["Photographic paper", "Cotton, linen or wool", "Paper and board", "Metal and textile", "Glass and ceramic",
             "Paper or parchment", "Paper and ink", "Printed paper", "Mixed domestic materials", "Wood and metal"]
YEARS = [
    [1908, 1919, 1927, 1947, 1935, 1892, 1951, 1904, 1963, 1978],
    [1885, 1920, 1942, 1930, 1898, 1956, 1910, 1875, 1977, 1938],
    [1869, 1902, 1926, 1915, 1888, 1934, 1967, 1897, 1921, 1953],
    [1932, 1941, 1910, 1938, 1952, 1940, 1924, 1961, 1977, 1985],
    [1895, 1910, 1887, 1935, 1928, 1946, 1905, 1922, 1879, 1958],
    [1824, 1886, 1921, 1907, 1862, 1841, 1930, 1818, 1927, 1899],
    [1871, 1929, 1903, 1936, 1952, 1882, 1961, 1919, 1987, 1948],
    [1956, 1983, 1927, 1962, 1935, 1949, 1911, 1908, 1974, 1988],
    [1930, 1890, 1915, 1878, 1924, 1951, 1906, 1889, 1865, 1942],
    [1880, 1905, 1923, 1876, 1892, 1911, 1930, 1948, 1887, 1902],
]


def collection():
    rows = []
    for group_index, (category, titles) in enumerate(GROUPS.items()):
        for index, title in enumerate(titles):
            number = len(rows) + 1
            year = YEARS[group_index][index]
            shelf = f"Store {chr(65 + group_index // 4)} / Box {group_index + 1:02}"
            rows.append({
                "archive_reference_canonical": f"DEMO/2026/{number:03}", "object_name": title.split(" ")[0] + " " + ("photograph" if group_index == 0 else category.split(" & ")[0].lower().rstrip("s")),
                "title": title, "date_received": f"2026-08-{index + 1:02}",
                "brief_description": f"Fictional example of {title.lower()}, imagined as part of everyday life in Collingham around {year}. Created for training; it does not describe a real collection item.",
                "donated_by": PEOPLE[index], "donation_date": f"2026-08-{index + 1:02}",
                "copyright": "Synthetic demonstration content; no historical rights assertion.",
                "associated_people": [PEOPLE[index]], "associated_places": ["Collingham", PLACES[index % 5]],
                "home_location": shelf, "home_location_date": "2026-08-12", "current_location": shelf, "current_location_date": "2026-08-12",
                "physical_description": f"An invented {MATERIALS[group_index].lower()} item. Illustrative construction and wear are provided for catalogue practice only.",
                "size": ["180 x 240 mm", "360 x 240 x 70 mm", "210 x 148 x 20 mm"][index % 3],
                "condition": ["Good - minor surface wear", "Fair - stable, with edge wear", "Good - stored in protective enclosure"][index % 3],
                "notes": "FICTIONAL TRAINING ITEM. People, events, provenance and object histories are invented. Thumbnails are symbolic illustrations, not photographs of real holdings.",
                "cross_references": f"Demonstration group {group_index + 1:02}", "public_access_summary": f"Fictional training example: {title.lower()}.",
                "category": category, "era": str(year), "material": MATERIALS[group_index], "is_sample": True,
                "provenance_note": "Generated synthetic collection, version 1, 2026-09-10. No real accession.",
            })
    assert len(rows) == 100
    assert len({row["archive_reference_canonical"] for row in rows}) == 100
    return rows


def scan_card(number, title, object_name):
    return {
        "object_name": object_name, "archive_reference_canonical": f"DEMO/2026/{number:03}",
        "title": title, "date_received": "10 Sep 2026",
        "brief_description": "A fictional village archive item for scanning practice.\nThe donor and object history are invented.",
        "donated_by": "Helena Quillmere", "donation_date": "10 Sep 2026",
        "copyright": "Synthetic training material", "associated_people": "Helena Quillmere",
        "associated_places": "Collingham; Imagined Willow Lane", "home_location": "Store A / Box 12",
        "home_location_date": "10 Sep 2026", "current_location": "Store A / Box 12", "current_location_date": "10 Sep 2026",
        "physical_description": "Fictional archive document on cream paper.\nBlack ink with a handwritten donor name.\nStored in an acid-free folder.",
        "size": "240 x 180 mm", "condition": "Good; slight wear at edges",
        "notes": "FICTIONAL TRAINING ITEM.\nNo real donor or historical event is represented.",
        "cross_references": "Synthetic collection / scanning exercise",
    }


def write_card(path, values, font_path):
    from reportlab.pdfgen import canvas
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.lib.utils import simpleSplit

    pdfmetrics.registerFont(TTFont("DemoHand", str(font_path)))
    pdf = canvas.Canvas(str(path), pagesize=(WIDTH, HEIGHT), invariant=1)
    pdf.setTitle("FICTIONAL TRAINING CARD - " + values["title"])
    for page in range(2):
        pdf.setFillColorRGB(.993, .985, .955)
        pdf.rect(0, 0, WIDTH, HEIGHT, fill=1, stroke=0)
        pdf.setFillColorRGB(.12, .22, .19)
        pdf.setFont("Times-BoldItalic", 22)
        pdf.drawCentredString(WIDTH / 2, HEIGHT - 43, "Collingham and District Local History Society")
        pdf.setFont("Helvetica", 10)
        pdf.drawCentredString(WIDTH / 2, HEIGHT - 66, "SYNTHETIC TRAINING CARD  |  ALL CONTENT FICTIONAL  |  " + ("FRONT" if page == 0 else "BACK"))
        for cell in CELLS:
            key, label, side, x, y, w, h = cell
            if side != page:
                continue
            pdf.setStrokeColorRGB(.32, .37, .32)
            pdf.setLineWidth(.65)
            pdf.rect(x, HEIGHT - y - h, w, h)
            pdf.setFillColorRGB(.28, .32, .27)
            pdf.setFont("Helvetica", 9)
            pdf.drawString(x + 9, HEIGHT - y - 15, label)
            hand = key in {"donated_by", "associated_people"}
            font = "DemoHand" if hand else "Helvetica"
            size = 18 if hand else (11 if w <= 130 else 16)
            pdf.setFont(font, size)
            pdf.setFillColorRGB(.27, .29, .31) if hand else pdf.setFillColorRGB(.12, .16, .16)
            left, top, right, bottom = value_box(cell)
            lines = []
            for line in values.get(key, "").splitlines():
                lines.extend(simpleSplit(line, font, size, right - left))
            for line_index, line in enumerate(lines):
                baseline = top + size + line_index * (size + 3)
                if baseline > bottom + 2:
                    raise ValueError(f"Card text overflows {key}: {line}")
                pdf.drawString(left, HEIGHT - baseline, line)
        pdf.showPage()
    pdf.save()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cards", action="store_true", help="Also rebuild the two PDF scan fixtures (requires reportlab)")
    args = parser.parse_args()
    folder = ROOT / "demo"
    folder.mkdir(exist_ok=True)
    (folder / "collection.json").write_text(json.dumps({"synthetic": True, "version": 1, "count": 100, "notice": "Every item, person and provenance is fictional. These are training records, not actual holdings.", "records": collection()}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    if args.cards:
        cards = folder / "cards"
        cards.mkdir(exist_ok=True)
        benchmark = []
        for number, filename, title, kind in [
            (101, "01-first-accession.pdf", "Willow Lane garden deed", "Deed"),
            (103, "02-later-accession.pdf", "Orchard walking brochure", "Brochure"),
        ]:
            values = scan_card(number, title, kind)
            target = cards / filename
            write_card(target, values, folder / "fonts" / "HomemadeApple-Regular.ttf")
            benchmark.append({"file": filename, "sha256": hashlib.sha256(target.read_bytes()).hexdigest(), "expected_fields": values})
        (folder / "benchmark.json").write_text(json.dumps({"notice": "Gold text is used only after OCR to score these exact synthetic files; never as OCR input.", "fixtures": benchmark}, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
