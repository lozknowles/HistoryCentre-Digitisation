import os

from app.web import create_app


app = create_app()


if __name__ == "__main__":
    app.run(
        host=os.environ.get("COLLINGHAM_HOST", "127.0.0.1"),
        port=int(os.environ.get("COLLINGHAM_PORT", "8000")),
        debug=False,
    )

