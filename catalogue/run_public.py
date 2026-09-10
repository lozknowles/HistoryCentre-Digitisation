"""Separate public entrypoint. Production uses gunicorn on loopback behind Apache."""
import os
from app.public_site import create_public_app

if os.environ.get("CDLHS_HOSTED") == "1":
    required = ("CDLHS_SESSION_SECRET", "CDLHS_STAFF_PASSWORD_HASH", "CDLHS_PUBLIC_ORIGINS")
    if any(not os.environ.get(key) or os.environ[key].startswith("REPLACE_") for key in required):
        raise RuntimeError("Hosted archive requires configured staff access, a stable session secret and explicit origins.")
app = create_public_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("CDLHS_PUBLIC_PORT", "18674")), debug=False)
