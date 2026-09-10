"""Public-boundary, date, enquiry and private-photo checks on fresh demo DBs."""
import hashlib
import io
import json
import sqlite3
import uuid
from datetime import datetime, timezone

import pytest
from PIL import Image
from werkzeug.security import generate_password_hash

from app.public_site import PUBLIC_FIELDS, create_public_app, second_saturday, visit_days
from scripts.create_demo_database import create_demo

BASE = '/cdlhs/api'
HEADERS = {'Origin': 'https://lozknowles.com', 'X-Archive-Request': 'public-site'}
PASSWORD = 'Fictional-test-password-only-82'


@pytest.fixture
def public(tmp_path):
    db = tmp_path / 'demo.sqlite'
    create_demo(db)
    config = {'TESTING': True, 'SECRET_KEY': 'test-session-key-only', 'STAFF_PASSWORD_HASH': generate_password_hash(PASSWORD), 'PUBLIC_ORIGINS': {'https://lozknowles.com'}, 'SESSION_COOKIE_SECURE': False}
    app = create_public_app(db, tmp_path / 'private-photos', config)
    return app, app.test_client(), db, tmp_path / 'private-photos'


def login(client):
    response = client.post(BASE + '/staff/login', headers=HEADERS, json={'username': 'curator', 'password': PASSWORD})
    assert response.status_code == 200


def visit(**changes):
    value = {'request_key': str(uuid.uuid4()), 'name': 'Fictional Visitor', 'email': 'visitor@example.invalid', 'consent': True, 'website': '', 'day': visit_days()[0]['date'], 'arrival': '10:30', 'party_size': 2, 'items': ['item-1'], 'research': '', 'notes': 'Synthetic test only.'}
    return value | changes


def offer(**changes):
    return {'request_key': str(uuid.uuid4()), 'name': 'Fictional Donor', 'email': 'donor@example.invalid', 'consent': True, 'website': '', 'kind': 'donation', 'title': 'Fictional medicine bottle', 'category': 'Objects', 'description': 'Empty brown glass bottle for a demonstration.', 'connection': 'Invented village chemist story.', 'authority': True} | changes


def photograph():
    encoded = io.BytesIO()
    im = Image.new('RGB', (90, 70), '#826e42')
    exif = Image.Exif(); exif[270] = 'Private original metadata'
    im.save(encoded, 'JPEG', exif=exif)
    return encoded.getvalue()


def send_offer(client, data, files=None):
    return client.post(BASE + '/offers', headers=HEADERS, data={'details': json.dumps(data), 'photos': [(io.BytesIO(raw), name) for raw, name in (files or [])]}, content_type='multipart/form-data')


def count(db, table):
    with sqlite3.connect(db) as conn:
        return conn.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0]


def test_public_catalogue_has_only_curated_fields_and_separate_routes(public):
    _, client, _, _ = public
    response = client.get(BASE + '/catalogue')
    assert response.status_code == 200
    data = response.json
    assert data['demo'] and len(data['items']) == 100
    assert all(set(item) == PUBLIC_FIELDS and item['synthetic'] for item in data['items'])
    assert 'donor' not in response.text and 'storage_location' not in response.text and 'raw_ocr' not in response.text
    for route in ['/api/records', '/api/export', '/workspace/', '/scan', '/cdlhs/api/records', '/cdlhs/api/uploads']:
        assert client.get(route).status_code == 404
    assert client.get(BASE + '/catalogue?q=zzzz-nonexistent').json['items'] == []
    category = data['items'][0]['category']
    assert all(item['category'] == category for item in client.get(BASE + '/catalogue', query_string={'category': category}).json['items'])


def test_real_database_never_auto_publishes(tmp_path):
    app = create_public_app(tmp_path / 'private.sqlite', tmp_path / 'photos', {'TESTING': True})
    assert app.test_client().get(BASE + '/catalogue').json['items'] == []


def test_second_saturdays_and_london_cutoff():
    for year in (2024, 2026, 2027):
        for month in range(1, 13):
            day = second_saturday(year, month)
            assert day.weekday() == 5 and 8 <= day.day <= 14
    # 23:30 UTC is already the second Saturday in London in September.
    days = visit_days(datetime(2026, 9, 11, 23, 30, tzinfo=timezone.utc))
    assert days[0]['date'] == '2026-10-10'
    assert len(days) == 12 and days[-1]['date'] == '2027-09-11'
    assert visit_days(datetime(2026, 12, 31, tzinfo=timezone.utc))[0]['date'] == '2027-01-09'


def test_visits_saved_once_with_snapshot_and_private_contact(public):
    _, client, db, _ = public
    data = visit()
    first = client.post(BASE + '/visits', headers=HEADERS, json=data)
    assert first.status_code == 201 and first.json['reference'].startswith('VIS-')
    repeated = client.post(BASE + '/visits', headers=HEADERS, json=data)
    assert repeated.status_code == 200 and repeated.json['reference'] == first.json['reference']
    assert count(db, 'public_enquiries') == 1
    assert client.post(BASE + '/visits', headers=HEADERS, json=data | {'name': 'Changed'}).status_code == 400
    assert client.get(BASE + '/staff/enquiries').status_code == 401
    login(client)
    enquiry = client.get(BASE + '/staff/enquiries').json['enquiries'][0]
    assert enquiry['status'] == 'new' and enquiry['payload']['demo']
    assert enquiry['payload']['items'][0]['reference']
    assert 'request_hash' not in enquiry and 'request_key' not in enquiry


@pytest.mark.parametrize('changes', [{'day': '2026-09-13'}, {'day': '2000-01-08'}, {'party_size': True}, {'party_size': 31}, {'arrival': '14:00'}, {'items': ['item-1', 'item-1']}, {'items': ['item-9999']}, {'items': [], 'research': ''}, {'email': 'bad'}, {'consent': False}, {'website': 'https://spam.invalid'}, {'request_key': 'bad'}])
def test_invalid_visit_does_not_save(public, changes):
    _, client, db, _ = public
    assert client.post(BASE + '/visits', headers=HEADERS, json=visit(**changes)).status_code == 400
    assert count(db, 'public_enquiries') == 0


def test_origin_and_rate_controls(public):
    _, client, db, _ = public
    assert client.post(BASE + '/visits', json=visit()).status_code == 403
    assert client.post(BASE + '/visits', headers=HEADERS | {'Origin': 'https://elsewhere.invalid'}, json=visit()).status_code == 403
    for _ in range(8):
        assert client.post(BASE + '/visits', headers=HEADERS, json=visit()).status_code == 201
    assert client.post(BASE + '/visits', headers=HEADERS, json=visit()).status_code == 429
    with sqlite3.connect(db) as conn:
        buckets = conn.execute('SELECT bucket_key FROM public_request_limits').fetchall()
        assert all(len(key[0]) == 64 for key in buckets)


def test_offer_photo_original_preserved_preview_private_and_no_accession(public):
    _, client, db, folder = public
    raw, data = photograph(), offer(kind='loan', loan_period='Six months')
    response = send_offer(client, data, [(raw, '../../outside.jpg')])
    assert response.status_code == 201
    assert count(db, 'catalogue_records') == 100 and count(db, 'public_enquiries') == 1
    assert len(list(folder.iterdir())) == 2
    assert send_offer(client, data, [(raw, 'renamed.jpg')]).json['reference'] == response.json['reference']
    assert len(list(folder.iterdir())) == 2
    login(client)
    item = client.get(BASE + '/staff/enquiries').json['enquiries'][0]
    assert item['kind'] == 'loan' and item['payload']['loan_period'] == 'Six months'
    photo = item['photos'][0]
    url = BASE + '/staff/enquiries/' + item['enquiry_id'] + '/photos/' + photo['id']
    original = client.get(url + '?original=1')
    assert original.status_code == 200 and hashlib.sha256(original.data).digest() == hashlib.sha256(raw).digest()
    assert original.headers['Content-Disposition'].startswith('attachment;')
    preview = client.get(url)
    with Image.open(io.BytesIO(preview.data)) as image:
        assert not image.getexif()
    assert preview.headers['Cache-Control'] == 'no-store'
    client.post(BASE + '/staff/logout', headers=HEADERS, json={})
    assert client.get(url).status_code == 401 and client.get(url + '?original=1').status_code == 401


@pytest.mark.parametrize('mode', ['bad-image', 'too-many', 'oversize', 'no-authority', 'bad-kind'])
def test_bad_offers_leave_no_rows_or_photos(public, mode):
    _, client, db, folder = public
    data = offer()
    files = [(photograph(), 'item.jpg')]
    if mode == 'bad-image': files = [(b'<script>alert(1)</script>', 'photo.jpg')]
    if mode == 'too-many': files *= 5
    if mode == 'oversize': files = [(b'a' * (5 * 1024 * 1024 + 1), 'photo.jpg')]
    if mode == 'no-authority': data['authority'] = False
    if mode == 'bad-kind': data['kind'] = 'sale'
    assert send_offer(client, data, files).status_code == 400
    assert count(db, 'public_enquiries') == 0 and not folder.exists()


def test_staff_audited_revision_and_cookie_boundary(public):
    _, client, _, _ = public
    assert client.post(BASE + '/staff/login', headers=HEADERS, json={'username': 'curator', 'password': 'wrong'}).status_code == 401
    assert client.post(BASE + '/staff/login', headers=HEADERS, json={'username': 'Fictional élève', 'password': PASSWORD}).status_code == 401
    client.post(BASE + '/visits', headers=HEADERS, json=visit())
    login(client)
    item = client.get(BASE + '/staff/enquiries').json['enquiries'][0]
    path = BASE + '/staff/enquiries/' + item['enquiry_id']
    update = {'status': 'contacted', 'reviewer': 'Demo Archivist', 'notes': 'Fictional follow-up recorded.', 'revision': item['revision']}
    assert client.patch(path, headers=HEADERS, json=update).status_code == 200
    assert client.patch(path, headers=HEADERS, json=update).status_code == 409
    saved = client.get(BASE + '/staff/enquiries').json['enquiries'][0]
    assert saved['revision'] == 2 and saved['history'][0]['reviewer'] == 'Demo Archivist'
    assert client.patch(path, headers=HEADERS, json=update | {'revision': 2, 'status': 'accepted for accession'}).status_code == 400
    client.post(BASE + '/staff/logout', headers=HEADERS, json={})
    assert client.patch(path, headers=HEADERS, json=update).status_code == 401


def test_staff_publication_explicit_and_withdrawal_persists(public):
    app, client, db, folder = public
    path = BASE + '/staff/publication/1'
    assert client.get(BASE + '/staff/publication').status_code == 401
    assert client.delete(path, headers=HEADERS, json={'reviewer': 'Demo Archivist'}).status_code == 401
    login(client)
    draft = client.get(BASE + '/staff/publication').json['candidates'][0]['draft']
    assert client.put(path, headers=HEADERS, json={'item': draft, 'reviewer': 'Demo Archivist'}).status_code == 400
    assert client.delete(path, headers=HEADERS, json={'reviewer': 'Demo Archivist'}).status_code == 200
    assert len(client.get(BASE + '/catalogue').json['items']) == 99
    reopened = create_public_app(db, folder, app.config).test_client()
    assert len(reopened.get(BASE + '/catalogue').json['items']) == 99
    draft['description'] = 'A specifically reviewed public description.'
    assert client.put(path, headers=HEADERS, json={'item': draft | {'donor': 'Must never leak'}, 'reviewer': 'Demo Archivist', 'approved': True}).status_code == 400
    assert client.put(path, headers=HEADERS, json={'item': draft, 'reviewer': 'Demo Archivist', 'approved': True}).status_code == 200
    candidate = client.get(BASE + '/staff/publication').json['candidates'][0]
    assert candidate['published'] and candidate['draft']['description'] == draft['description']
    assert len(client.get(BASE + '/catalogue').json['items']) == 100


def test_production_cookie_is_secure(public):
    app, _, _, _ = public
    app.config['SESSION_COOKIE_SECURE'] = True
    response = app.test_client().post(BASE + '/staff/login', headers=HEADERS, json={'username': 'curator', 'password': PASSWORD})
    cookie = response.headers['Set-Cookie']
    assert 'Secure;' in cookie and 'HttpOnly;' in cookie and 'SameSite=Strict' in cookie and 'Path=/cdlhs' in cookie
