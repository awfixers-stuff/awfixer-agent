from __future__ import annotations

import pytest
from pydantic import ValidationError

from prwatch.config import Settings, get_settings


@pytest.fixture(autouse=True)
def _clear_settings_cache() -> None:
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_settings_loads_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@localhost/prwatch")
    monkeypatch.setenv("PRWATCH_MAX_CONCURRENCY", "2")
    monkeypatch.setenv("PRWATCH_WORKSPACE_ROOT", "/tmp/ws")

    settings = Settings()

    assert settings.database_url == "postgresql://u:p@localhost/prwatch"
    assert settings.max_concurrency == 2
    assert settings.workspace_root == "/tmp/ws"


def test_settings_requires_database_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)

    with pytest.raises(ValidationError):
        Settings()


def test_settings_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@localhost/prwatch")

    settings = Settings()

    assert settings.max_concurrency == 4
    assert settings.workspace_root == "/data/workspaces"
    assert settings.worker_id == "worker-1"
    assert settings.omp_command == "agent"
    assert settings.thinking == "high"
    assert settings.task_timeout_seconds == 2400.0


def test_get_settings_is_cached(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@localhost/prwatch")

    first = get_settings()
    second = get_settings()

    assert first is second
