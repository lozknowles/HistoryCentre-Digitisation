"""Keep all review tests away from a user's catalogue database."""

import pytest


@pytest.fixture(autouse=True)
def isolated_catalogue(monkeypatch, tmp_path):
    monkeypatch.setenv("COLLINGHAM_DB", str(tmp_path / "catalogue.sqlite"))
