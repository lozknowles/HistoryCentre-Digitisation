"""The ruled front/back card, shared by the fixture writer and optical reader.

Coordinates are in points from the TOP LEFT of a 900 x 620 card. OCR reads only
the value areas, never PDF text or the synthetic benchmark's expected answers.
"""

WIDTH, HEIGHT = 900, 620
# key, printed label, page, x, y, width, height
CELLS = [
    ("object_name", "Simple object name", 0, 30, 100, 600, 58),
    ("archive_reference_canonical", "ID number", 0, 630, 100, 240, 58),
    ("title", "Title", 0, 30, 158, 600, 70),
    ("date_received", "Date received", 0, 630, 158, 240, 70),
    ("brief_description", "Brief description", 0, 30, 228, 840, 96),
    ("donated_by", "Donated / loaned by", 0, 30, 324, 600, 62),
    ("donation_date", "Date", 0, 630, 324, 240, 62),
    ("copyright", "Copyright", 0, 30, 386, 840, 52),
    ("associated_people", "Associated people", 0, 30, 438, 840, 52),
    ("associated_places", "Associated places", 0, 30, 490, 840, 52),
    ("home_location", "Home location", 0, 30, 542, 300, 52),
    ("home_location_date", "Date", 0, 330, 542, 120, 52),
    ("current_location", "Current location", 0, 450, 542, 300, 52),
    ("current_location_date", "Date", 0, 750, 542, 120, 52),
    ("physical_description", "Physical description, family, street, house etc.", 1, 30, 100, 840, 216),
    ("size", "Size", 1, 30, 316, 420, 70),
    ("condition", "Condition", 1, 450, 316, 420, 70),
    ("notes", "Notes, cross references etc.", 1, 30, 386, 840, 148),
    ("cross_references", "Cross references", 1, 30, 534, 840, 60),
]
CARD_FIELDS = [cell[0] for cell in CELLS]
LABELS = {cell[0]: cell[1] for cell in CELLS}

# Value regions on the recovered A4 David Johnson card, normalised from its
# preserved 960 x 1378 preview. This is an explicitly selected profile, not an
# automatic layout guess; different/rotated forms use document transcription.
HISTORIC_BOXES = {
    "object_name": (0, 90, 116, 677, 151), "archive_reference_canonical": (0, 692, 113, 885, 147),
    "title": (0, 91, 176, 677, 211), "date_received": (0, 697, 175, 884, 204),
    "brief_description": (0, 88, 237, 881, 340), "donated_by": (0, 191, 370, 675, 395),
    "donation_date": (0, 703, 369, 884, 393), "copyright": (0, 188, 411, 885, 435),
    "associated_people": (0, 214, 450, 884, 491), "associated_places": (0, 87, 516, 886, 554),
    "home_location": (0, 88, 583, 278, 614), "home_location_date": (0, 296, 580, 483, 613),
    "current_location": (0, 496, 579, 685, 611), "current_location_date": (0, 699, 578, 886, 611),
    "physical_description": (1, 112, 176, 912, 361), "size": (1, 112, 408, 493, 444),
    "condition": (1, 519, 403, 903, 441), "notes": (1, 110, 498, 911, 666),
}


def value_box(cell):
    _, _, _, x, y, width, height = cell
    return (x + 9, y + 23, x + width - 9, y + height - 5)
