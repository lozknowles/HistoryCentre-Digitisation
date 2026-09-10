"""A separate public app: curated catalogue, visit requests and offers.

It never registers the internal workspace, raw OCR, catalogue export or scan
routes. Enquiries/photos require a staff session and stay outside the web root.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
import uuid
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from functools import wraps
from pathlib import Path
from zoneinfo import ZoneInfo

from flask import Flask, current_app, jsonify, request, send_file, send_from_directory, session
from PIL import Image, ImageOps, UnidentifiedImageError
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.security import check_password_hash

from .db import connect

ROOT = Path(__file__).resolve().parents[1]
PREFIX = "/cdlhs/api"
MAX_PHOTOS = 4
PUBLIC_FIELDS = {"id", "reference", "title", "object", "category", "era", "description", "material", "size", "places", "people", "synthetic"}
TIMES = ["10:00", "10:30", "11:00", "11:30", "12:00", "12:30"]
STATUSES = {"visit": ["new", "contacted", "confirmed", "completed", "declined", "cancelled"], "donation": ["new", "contacted", "viewing arranged", "accepted for accession", "declined", "withdrawn"], "loan": ["new", "contacted", "viewing arranged", "accepted for accession", "declined", "withdrawn"]}


@contextmanager
def database():
    conn = connect(current_app.config["DATABASE_PATH"])
    try:
        with conn:
            yield conn
    finally:
        conn.close()


def second_saturday(year, month):
    first = date(year, month, 1)
    return first + timedelta(days=(5 - first.weekday()) % 7 + 7)


def visit_days(now=None):
    now = now or datetime.now(timezone.utc)
    today = now.astimezone(ZoneInfo("Europe/London")).date()
    result, offset = [], 0
    while len(result) < 12:
        month_index = today.year * 12 + today.month - 1 + offset
        day = second_saturday(month_index // 12, month_index % 12 + 1)
        offset += 1
        if day <= today:
            continue
        result.append({"date": day.isoformat(), "label": day.strftime("Saturday %d %B %Y").replace(" 0", " "), "day": day.day, "month": day.strftime("%B %Y")})
    return result


def demo_database(conn):
    row = conn.execute("SELECT value FROM workspace_meta WHERE key='synthetic_demo'").fetchone()
    return bool(row and row[0] == "true")


def as_list(value):
    if isinstance(value, list):
        return value
    try:
        result = json.loads(value or "[]")
        return result if isinstance(result, list) else [str(result)]
    except (TypeError, ValueError):
        return [str(value)] if value else []


def projected_record(row):
    """Used only for the explicitly synthetic seed or a staff-reviewed draft."""
    return {
        "id": f"item-{row['record_id']}",
        "reference": row["archive_reference_canonical"],
        "title": row["title"], "object": row["object_name"] or "",
        "category": row["category"] or "Uncategorised", "era": row["era"] or "",
        "description": row["public_access_summary"] or row["brief_description"] or "",
        "material": row["material"] or "", "size": row["size"] or "",
        "places": as_list(row["associated_places_json"]),
        "people": as_list(row["associated_people_json"]),
        "synthetic": bool(row["is_sample"]),
    }


def seed_public_demo():
    with database() as conn:
        if not demo_database(conn) or conn.execute("SELECT 1 FROM workspace_meta WHERE key='public_demo_initialised'").fetchone():
            return
        rows = conn.execute("SELECT r.*,d.category,d.era,d.material FROM catalogue_records r LEFT JOIN record_details d USING(record_id) WHERE r.is_sample=1 ORDER BY r.record_id").fetchall()
        for row in rows:
            item = projected_record(row)
            conn.execute("INSERT OR IGNORE INTO public_catalogue(public_id,record_id,reference,payload_json,published,reviewed_by) VALUES(?,?,?,?,1,'Fictional collection generator')", (item["id"], row["record_id"], item["reference"], json.dumps(item)))
        conn.execute("INSERT INTO workspace_meta(key,value) VALUES('public_demo_initialised','true')")


def error(message, status=400):
    return jsonify(error=message), status


def text(data, key, limit=300, required=False):
    value = data.get(key, "")
    if not isinstance(value, str) or len(value) > limit:
        raise ValueError(f"Please check {key.replace('_', ' ')} (maximum {limit} characters).")
    value = value.strip()
    if required and not value:
        raise ValueError(f"Please enter {key.replace('_', ' ')}.")
    return value


def body():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ValueError("Please submit the completed form.")
    return data


def client_guard():
    if request.headers.get("X-Archive-Request") != "public-site":
        return error("Please submit this request from the archive website.", 403)
    origin = request.headers.get("Origin", "")
    if origin not in current_app.config["PUBLIC_ORIGINS"]:
        return error("This request did not come from the archive website.", 403)


def limited(kind, maximum=8, seconds=3600):
    now = int(time.time())
    address = request.remote_addr or "unknown"
    key = hmac.new(current_app.secret_key.encode(), f"{kind}:{address}:{now // seconds}".encode(), hashlib.sha256).hexdigest()
    with database() as conn:
        conn.execute("DELETE FROM public_request_limits WHERE expires_at<?", (now,))
        count = conn.execute("INSERT INTO public_request_limits(bucket_key,count,expires_at) VALUES(?,1,?) ON CONFLICT(bucket_key) DO UPDATE SET count=count+1 RETURNING count", (key, now + seconds * 2)).fetchone()[0]
    return count > maximum


def staff_required(fn):
    @wraps(fn)
    def protected(*args, **kwargs):
        if not session.get("staff"):
            return error("Staff sign-in is required.", 401)
        return fn(*args, **kwargs)
    return protected


def contact(data):
    name = text(data, "name", 120, True)
    email = text(data, "email", 254, True)
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        raise ValueError("Please enter a valid email address.")
    if data.get("consent") is not True:
        raise ValueError("Please confirm that we may contact you about this request.")
    if text(data, "website", 200):
        raise ValueError("This request could not be accepted.")
    key = text(data, "request_key", 36, True)
    try:
        uuid.UUID(key)
    except ValueError:
        raise ValueError("Please refresh the form and try again.") from None
    return {"name": name, "email": email, "consent": True}, key


def saved_request(key, checksum):
    with database() as conn:
        row = conn.execute("SELECT reference,request_hash FROM public_enquiries WHERE request_key=?", (key,)).fetchone()
    if row:
        if row["request_hash"] != checksum:
            raise ValueError("An earlier version of this request was already saved. Start a new request for changed details.")
        return jsonify(reference=row["reference"], saved=True, repeated=True)


def save_enquiry(kind, payload, key, checksum, photos=None):
    enquiry_id = uuid.uuid4().hex
    reference = ("VIS" if kind == "visit" else "OFR") + "-" + secrets.token_hex(5).upper()
    with database() as conn:
        conn.execute("INSERT INTO public_enquiries(enquiry_id,request_key,request_hash,kind,reference,payload_json,photos_json) VALUES(?,?,?,?,?,?,?)", (enquiry_id, key, checksum, kind, reference, json.dumps(payload), json.dumps(photos or [])))
    return jsonify(reference=reference, saved=True), 201


def create_public_app(db_path=None, upload_root=None, config=None):
    app = Flask(__name__)
    app.config.update(DATABASE_PATH=str(db_path or os.environ.get("COLLINGHAM_DB", ROOT / "runtime/public-demo.sqlite")), UPLOAD_FOLDER=str(upload_root or os.environ.get("CDLHS_OFFER_UPLOADS", ROOT / "runtime/offer-photos")), PUBLIC_ORIGINS=set(os.environ.get("CDLHS_PUBLIC_ORIGINS", "http://127.0.0.1:18674").split(",")), SECRET_KEY=os.environ.get("CDLHS_SESSION_SECRET") or secrets.token_urlsafe(48), STAFF_USER=os.environ.get("CDLHS_STAFF_USER", "curator"), STAFF_PASSWORD_HASH=os.environ.get("CDLHS_STAFF_PASSWORD_HASH", ""), MAX_CONTENT_LENGTH=22*1024*1024, SESSION_COOKIE_NAME="cdlhs_staff", SESSION_COOKIE_PATH="/cdlhs", SESSION_COOKIE_SECURE=True, SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE="Strict", PERMANENT_SESSION_LIFETIME=timedelta(hours=8), STATIC_FOLDER=str(Path(os.environ.get("CDLHS_STATIC_DIR", ROOT.parent / "project/dist-public"))))
    if config:
        app.config.update(config)
    # Production only listens on loopback; Apache supplies the final proxy hop.
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)
    with app.app_context():
        seed_public_demo()

    @app.before_request
    def guard_writes():
        if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
            return client_guard()

    @app.after_request
    def response_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Robots-Tag"] = "noindex, nofollow, noarchive"
        response.headers["Content-Security-Policy"] = "default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; form-action 'self'"
        return response

    @app.errorhandler(ValueError)
    def invalid(exc):
        return error(str(exc))

    @app.errorhandler(413)
    def oversized(_exc):
        return error("Choose up to four photographs, each smaller than 5 MB.", 413)

    @app.errorhandler(sqlite3.IntegrityError)
    def conflict(_exc):
        return error("This request may already have been saved. Retry without changing the form to retrieve its reference.", 409)

    @app.get(PREFIX + "/catalogue")
    def catalogue():
        with database() as conn:
            items = [json.loads(row[0]) for row in conn.execute("SELECT payload_json FROM public_catalogue WHERE published=1 ORDER BY reference")]
            demo = demo_database(conn)
        query = request.args.get("q", "").strip().casefold()
        category = request.args.get("category", "")
        if query:
            items = [item for item in items if query in " ".join(str(item.get(k, "")) for k in ["title", "description", "reference", "object", "people", "places"]).casefold()]
        if category:
            items = [item for item in items if item["category"] == category]
        return jsonify(items=items, demo=demo, days=visit_days(), arrival_times=TIMES)

    @app.post(PREFIX + "/visits")
    def visits():
        data = body()
        payload, key = contact(data)
        payload.update(day=text(data, "day", 10, True), arrival=text(data, "arrival", 5, True), research=text(data, "research", 2000), notes=text(data, "notes", 1000))
        if payload["day"] not in {d["date"] for d in visit_days()}:
            raise ValueError("Choose an upcoming second Saturday from the list.")
        if payload["arrival"] not in TIMES:
            raise ValueError("Choose an arrival time between 10am and 12.30pm.")
        people = data.get("party_size")
        if type(people) is not int or not 1 <= people <= 30:
            raise ValueError("Enter the number of visitors, from 1 to 30. All group requests need confirmation.")
        payload["party_size"] = people
        ids = data.get("items", [])
        if not isinstance(ids, list) or len(ids) > 8 or any(not isinstance(x, str) for x in ids) or len(set(ids)) != len(ids):
            raise ValueError("Choose up to eight different catalogue items.")
        with database() as conn:
            selected = []
            for item_id in ids:
                row = conn.execute("SELECT payload_json FROM public_catalogue WHERE public_id=? AND published=1", (item_id,)).fetchone()
                if not row:
                    raise ValueError("An item in your list is no longer available. Refresh your selection.")
                item = json.loads(row[0])
                selected.append({"id": item["id"], "reference": item["reference"], "title": item["title"]})
            payload["items"] = selected
            payload["demo"] = demo_database(conn)
        if not ids and not payload["research"]:
            raise ValueError("Choose an item or tell us what you would like to research.")
        checksum = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
        previous = saved_request(key, checksum)
        if previous:
            return previous
        if limited("submission"):
            return error("Several requests have been received from this connection. Please try again later.", 429)
        return save_enquiry("visit", payload, key, checksum)

    @app.post(PREFIX + "/offers")
    def offers():
        try:
            data = json.loads(request.form.get("details", "{}"))
        except ValueError:
            raise ValueError("Please check the offer form.") from None
        if not isinstance(data, dict):
            raise ValueError("Please check the offer form.")
        payload, key = contact(data)
        kind = text(data, "kind", 12, True)
        if kind not in {"donation", "loan"}:
            raise ValueError("Choose donation or loan.")
        if data.get("authority") is not True:
            raise ValueError("Please confirm you are entitled to offer the item.")
        payload.update(title=text(data, "title", 200, True), category=text(data, "category", 100, True), era=text(data, "era", 100), description=text(data, "description", 3000, True), connection=text(data, "connection", 1500, True), provenance=text(data, "provenance", 1500), loan_period=text(data, "loan_period", 200), authority=True)
        files = request.files.getlist("photos")
        if len(files) > MAX_PHOTOS:
            raise ValueError("Choose at most four photographs.")
        checked, fingerprints = [], []
        for file in files:
            raw = file.read(5*1024*1024+1)
            if len(raw) > 5*1024*1024:
                raise ValueError("Each photograph must be smaller than 5 MB.")
            import io
            try:
                with Image.open(io.BytesIO(raw)) as im:
                    if im.format not in {"JPEG", "PNG", "WEBP"} or im.width*im.height > 30_000_000:
                        raise ValueError("Use a JPEG, PNG or WebP photograph below 30 megapixels.")
                    image_format = im.format
                    im.verify()
                with Image.open(io.BytesIO(raw)) as original:
                    preview = ImageOps.exif_transpose(original).convert("RGB")
                    preview.thumbnail((1600,1600))
                    encoded = io.BytesIO()
                    preview.save(encoded, "JPEG", quality=88)
            except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
                raise ValueError("One photograph could not be read. Choose a valid image and try again.") from None
            digest = hashlib.sha256(raw).hexdigest()
            checked.append((raw, encoded.getvalue(), image_format, preview.width, preview.height, digest))
            fingerprints.append(digest)
        with database() as conn:
            payload["demo"] = demo_database(conn)
        checksum = hashlib.sha256(json.dumps([kind,payload,fingerprints], sort_keys=True).encode()).hexdigest()
        previous = saved_request(key, checksum)
        if previous:
            return previous
        if limited("submission"):
            return error("Several requests have been received from this connection. Please try again later.", 429)
        folder = Path(current_app.config["UPLOAD_FOLDER"])
        folder.mkdir(parents=True, exist_ok=True)
        photos, written = [], []
        try:
            for raw, preview, image_format, width, height, digest in checked:
                photo_id = uuid.uuid4().hex
                suffix = {"JPEG":"jpg", "PNG":"png", "WEBP":"webp"}[image_format]
                original_path, preview_path = folder / f"{photo_id}.{suffix}", folder / f"{photo_id}-preview.jpg"
                original_path.write_bytes(raw); written.append(original_path)
                preview_path.write_bytes(preview); written.append(preview_path)
                photos.append({"id":photo_id,"original":original_path.name,"preview":preview_path.name,"sha256":digest,"width":width,"height":height,"mime":{"JPEG":"image/jpeg","PNG":"image/png","WEBP":"image/webp"}[image_format]})
            return save_enquiry(kind, payload, key, checksum, photos)
        except Exception:
            # Only files freshly created by this failed request are removed.
            for path in written:
                path.unlink(missing_ok=True)
            raise

    @app.get(PREFIX + "/staff/session")
    def staff_session():
        return jsonify(signed_in=bool(session.get("staff")))

    @app.post(PREFIX + "/staff/login")
    def staff_login():
        data = body()
        if limited("staff-login", 8, 900):
            return error("Too many sign-in attempts. Please try again in 15 minutes.", 429)
        configured = current_app.config["STAFF_PASSWORD_HASH"]
        if not configured:
            return error("Staff sign-in has not been configured by the site administrator.", 503)
        username, password = text(data, "username", 120), text(data, "password", 300)
        valid = check_password_hash(configured, password)
        if not valid or not hmac.compare_digest(username.encode(), current_app.config["STAFF_USER"].encode()):
            return error("The username or password was not recognised.", 401)
        session.clear(); session["staff"] = username; session.permanent = True
        return jsonify(signed_in=True)

    @app.post(PREFIX + "/staff/logout")
    def staff_logout():
        session.clear()
        return jsonify(signed_in=False)

    @app.get(PREFIX + "/staff/enquiries")
    @staff_required
    def enquiries():
        with database() as conn:
            rows = conn.execute("SELECT * FROM public_enquiries ORDER BY created_at DESC LIMIT 200").fetchall()
            result = []
            for row in rows:
                item = dict(row)
                item["payload"] = json.loads(item.pop("payload_json"))
                item["photos"] = [{"id":p["id"],"width":p["width"],"height":p["height"]} for p in json.loads(item.pop("photos_json"))]
                item.pop("request_hash"); item.pop("request_key")
                item["history"] = [dict(h) for h in conn.execute("SELECT previous_status,new_status,notes,reviewer,created_at FROM public_enquiry_history WHERE enquiry_id=? ORDER BY event_id", (row["enquiry_id"],))]
                result.append(item)
        return jsonify(enquiries=result, statuses=STATUSES)

    @app.patch(PREFIX + "/staff/enquiries/<enquiry_id>")
    @staff_required
    def update_enquiry(enquiry_id):
        data = body()
        status, notes = text(data, "status", 40, True), text(data, "notes", 3000)
        who = text(data, "reviewer", 120, True)
        with database() as conn:
            conn.execute("BEGIN IMMEDIATE")
            row = conn.execute("SELECT * FROM public_enquiries WHERE enquiry_id=?", (enquiry_id,)).fetchone()
            if not row:
                return error("Request not found.", 404)
            if data.get("revision") != row["revision"]:
                return error("Another staff member changed this request. Refresh before saving.", 409)
            if status not in STATUSES[row["kind"]]:
                raise ValueError("Choose a valid status for this request.")
            conn.execute("UPDATE public_enquiries SET status=?,staff_notes=?,revision=revision+1,updated_at=datetime('now') WHERE enquiry_id=?", (status,notes,enquiry_id))
            conn.execute("INSERT INTO public_enquiry_history(enquiry_id,previous_status,new_status,notes,reviewer) VALUES(?,?,?,?,?)", (enquiry_id,row["status"],status,notes,who))
        return jsonify(saved=True, notice="Status recorded. Contact the visitor separately; no email has been sent.")

    @app.get(PREFIX + "/staff/enquiries/<enquiry_id>/photos/<photo_id>")
    @staff_required
    def offer_photo(enquiry_id, photo_id):
        with database() as conn:
            row = conn.execute("SELECT photos_json FROM public_enquiries WHERE enquiry_id=?", (enquiry_id,)).fetchone()
        photo = next((p for p in json.loads(row[0]) if p["id"] == photo_id), None) if row else None
        if not photo:
            return error("Photograph not found.", 404)
        original = request.args.get("original") == "1"
        return send_file(Path(current_app.config["UPLOAD_FOLDER"]) / photo["original" if original else "preview"], mimetype=photo["mime"] if original else "image/jpeg", as_attachment=original, download_name="offered-item." + photo["original"].rsplit(".",1)[1])

    @app.get(PREFIX + "/staff/publication")
    @staff_required
    def publication_list():
        with database() as conn:
            rows = conn.execute("SELECT r.*,d.category,d.era,d.material FROM catalogue_records r LEFT JOIN record_details d USING(record_id) ORDER BY r.record_id").fetchall()
            published = {r[0]: (bool(r[1]), json.loads(r[2])) for r in conn.execute("SELECT record_id,published,payload_json FROM public_catalogue")}
            return jsonify(candidates=[{"record_id":r["record_id"],"published":published.get(r["record_id"], (False, None))[0],"draft":published[r["record_id"]][1] if r["record_id"] in published else projected_record(r)} for r in rows])

    @app.put(PREFIX + "/staff/publication/<int:record_id>")
    @staff_required
    def publish_record(record_id):
        data = body(); who = text(data, "reviewer", 120, True)
        if data.get("approved") is not True:
            raise ValueError("Review and approve the public fields before publishing.")
        item = data.get("item")
        if not isinstance(item, dict) or set(item) != PUBLIC_FIELDS:
            raise ValueError("The public entry contains unexpected or missing fields.")
        if item["id"] != f"item-{record_id}" or not isinstance(item["synthetic"], bool):
            raise ValueError("Please check the public record identity.")
        for key in PUBLIC_FIELDS - {"synthetic","places","people"}:
            item[key] = text(item, key, 4000, key in {"title","reference","description"})
        for key in {"places","people"}:
            if not isinstance(item[key],list) or len(item[key]) > 30 or any(not isinstance(v,str) or len(v)>200 for v in item[key]):
                raise ValueError("Please check the public people and places.")
        with database() as conn:
            row = conn.execute("SELECT archive_reference_canonical,is_sample FROM catalogue_records WHERE record_id=?", (record_id,)).fetchone()
            if not row:
                return error("Record not found.",404)
            if item["reference"] != row[0] or item["synthetic"] != bool(row[1]):
                raise ValueError("The reference and sample label must match the catalogue.")
            conn.execute("INSERT INTO public_catalogue(public_id,record_id,reference,payload_json,published,reviewed_by) VALUES(?,?,?,?,1,?) ON CONFLICT(public_id) DO UPDATE SET payload_json=excluded.payload_json,published=1,reviewed_by=excluded.reviewed_by,updated_at=datetime('now')", (item["id"],record_id,item["reference"],json.dumps(item),who))
        return jsonify(published=True)

    @app.delete(PREFIX + "/staff/publication/<int:record_id>")
    @staff_required
    def withdraw_record(record_id):
        who = text(body(), "reviewer",120,True)
        with database() as conn:
            conn.execute("UPDATE public_catalogue SET published=0,reviewed_by=?,updated_at=datetime('now') WHERE record_id=?", (who,record_id))
        return jsonify(published=False)

    @app.get("/cdlhs/")
    @app.get("/cdlhs/index.html")
    def public_index():
        return send_from_directory(app.config["STATIC_FOLDER"], "index.html")

    @app.get("/cdlhs/assets/<path:filename>")
    def public_assets(filename):
        return send_from_directory(Path(app.config["STATIC_FOLDER"]) / "assets", filename)

    @app.get("/cdlhs/cdlhs-banner.jpg")
    def banner():
        return send_from_directory(app.config["STATIC_FOLDER"], "cdlhs-banner.jpg")

    return app
