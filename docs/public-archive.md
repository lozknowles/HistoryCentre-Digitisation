# Public archive and visitor enquiries

Public address: **https://lozknowles.com/cdlhs/index.html**. No link is added to the host website’s navigation, and the demo asks search engines not to index it. The address is public and can be shared directly; it is not an access-control mechanism.

## Visitor workflow

- Search titles, references, descriptions, associated names and places; filter by item type and open an entry.
- Add up to eight records to a viewing list. The list contains public IDs only and lasts for the browser session.
- Choose one of the next twelve second Saturdays, a preferred arrival between 10am and 12.30pm, and the number of visitors. Same-day and past dates are excluded to allow preparation. Each request needs staff confirmation; slots and capacity are not promised.
- Alternatively, offer an item as a donation or loan, describe its local connection and history, confirm authority to offer it, and attach up to four photographs. The mobile capture input requests the rear camera on supported phones; a file/gallery picker is also available.
- A saved enquiry returns a reference. Retry protection avoids duplicate requests when the same unchanged form is submitted again. Contact details and photographs stay private.

The first hosted version uses exactly 100 fictional records from `catalogue/demo/collection.json`. Every page labels this as a demonstration and asks for fictitious contact details. It is not CDLHS’s operational booking service. No automatic email is sent, no appointment is automatically confirmed, and no offer becomes an accession without the existing human accession process.

## Staff workflow

The unlinked staff page is **https://lozknowles.com/cdlhs/index.html?view=staff**. Use the separately supplied staff credentials; passwords and session keys do not belong in this repository.

The inbox shows visit requests, donations and loans. Open an enquiry to see contact details, the requested public records and private photographs. Record your name, status and notes after following up separately. Status changes are audited, and a revision guard prevents overwriting another staff member’s update. Marking an offer “accepted for accession” records a decision; it does not silently create a catalogue record or a legal transfer agreement.

The public catalogue review shows a restricted draft of each catalogue record. Edit the public description, check any names, enter your name and explicitly approve publication. Existing approved text is preserved when returning to review. Withdrawal removes an entry from public search without deleting the archive record. Newly accessioned real records are never automatically published.

The internal React workspace and the public app can use the same SQLite catalogue when configured by the administrator. The hosted public process does **not** expose `/workspace/`, raw `/api/records`, OCR, original archive scans or export routes. Keep the internal workspace on a trusted private host.

## Build and run

Use Python 3.10+ and the existing Node dependencies. From the repository root:

```bash
cd project
npm ci
npm run typecheck
npm run build
npm run build:public
cd ..
python -m pip install -r catalogue/requirements-dev.txt
python -m pytest catalogue/tests
python catalogue/scripts/create_demo_database.py --db catalogue/runtime/public-demo.sqlite
```

The demo creation command refuses to overwrite a database. Set `COLLINGHAM_DB` to its absolute path before `python catalogue/run_public.py`, then visit `http://127.0.0.1:18674/cdlhs/index.html`. The public entrypoint serves `project/dist-public` by default. Staff cookies require HTTPS by default; tests explicitly override this only in their isolated app configuration.

## Hosting on the existing server

The deployment uses the existing lozknowles.com HTTPS Apache virtual host and an isolated `cdlhs-archive` service account. A scoped include proxies only `/cdlhs/` to Gunicorn on **127.0.0.1:18674**. Static files and the Flask app are in a versioned release outside the existing web root. The host homepage, navigation, dirty website source and other applications are not rebuilt or modified.

- Releases: `/var/www/cdlhs-archive/releases/<source-commit>/`
- Selected release: `/var/www/cdlhs-archive/current`
- Data: `/var/www/cdlhs-archive/runtime/public-demo.sqlite`
- Offer originals and previews: `/var/www/cdlhs-archive/runtime/offer-photos/`
- Environment: `/var/www/cdlhs-archive/runtime/public.env`, root-owned mode 0600
- Service: `/etc/systemd/system/cdlhs-archive.service`
- Apache include: `/etc/apache2/conf-available/cdlhs-archive-routes.conf`

Templates are under `deploy/cdlhs/`. `CDLHS_HOSTED=1` fails startup if staff credentials, a stable random session secret or allowed origins are missing. The stable session secret signs an 8-hour HttpOnly, Secure, SameSite=Strict staff cookie. Writes require an allowed Origin and a custom request header; submissions and login attempts are rate limited. The loopback-only listener must not be exposed directly because it trusts Apache’s final forwarded hop.

Photographs are validated by decoding their actual contents, limited to 5 MB and 30 megapixels each, and stored under random names. Original bytes are preserved; staff previews remove EXIF metadata. The public catalogue contains no photo URLs, donor fields, private locations or raw OCR. The separate public app only registers the intended public and staff-session routes.

Back up the database **and** photograph folder together using a consistent SQLite backup or a brief stop of this service. Preserve the environment separately in protected administration storage. For rollback, select the previous verified release and restart only `cdlhs-archive`; to remove the public URL, remove its scoped include and gracefully reload Apache after a configuration check. Do not restore an old database over new enquiries.

Before using real visitor data, the archive operator must agree the named enquiry contact, retention/removal policy, staffing and booking procedure. This demonstration intentionally has no email integration or automated acceptance. The staff access file is supplied privately outside Git.

## Design and information sources

The banner is the society’s existing [Header_title.jpg](https://collingham-history.org.uk/wp-content/uploads/2015/10/Header_title.jpg), attributed to Collingham & District Local History Society; it is not newly generated historical evidence. The public-page style references the [official society website](https://collingham-history.org.uk/). Opening information (second Saturday, 10am–1pm, free admission, 11 Swinderby Road) was checked on the [History Centre page](https://collingham-history.org.uk/history-centre/) on 10 September 2026. Users are directed there to check current arrangements.

Deployment follows the [Flask Gunicorn guidance](https://flask.palletsprojects.com/en/stable/deploying/gunicorn/) and Apache’s [scoped reverse-proxy configuration](https://httpd.apache.org/docs/2.4/mod/mod_proxy.html#proxypass). Collection symbols are interface illustrations, not photographs of real holdings.

## Verification

`catalogue/tests/test_public_site.py` checks the public field allowlist, no automatic real-data publication, absent internal routes, London date cutoffs, second Saturdays across year boundaries, form validation, private storage, original-photo integrity, metadata-free previews, origin/rate controls, retry idempotency, authentication, audited staff updates, concurrent-update rejection, explicit publication and persistent withdrawal. All checks use temporary databases.

The original archive tests remain part of the suite. Actual OCR requires native Tesseract and Poppler, and is skipped on hosts that lack them. A browser upload/capture-input check does not qualify a physical mobile camera. No general handwriting accuracy claim is made by the public site.
