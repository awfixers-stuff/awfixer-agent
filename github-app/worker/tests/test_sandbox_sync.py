from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from prwatch.sandbox_exec import E2BSandboxRunner, _tar_worktree


def test_tar_worktree_includes_files(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "README.md").write_text("sync me", encoding="utf-8")
    payload = _tar_worktree(repo)
    assert len(payload) > 0


@pytest.mark.asyncio
async def test_e2b_ensure_session_uploads_tar(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "main.py").write_text("print('ok')\n", encoding="utf-8")

    mock_sandbox = MagicMock()
    mock_proc = MagicMock()
    mock_proc.exit_code = 0
    mock_sandbox.commands.run.return_value = mock_proc

    fake_module = MagicMock()
    fake_module.Sandbox.return_value = mock_sandbox
    with patch.dict(sys.modules, {"e2b_code_interpreter": fake_module}):
        runner = E2BSandboxRunner(api_key="test-key")
        await runner.ensure_session(repo)

    mock_sandbox.files.write.assert_called_once()
    args = mock_sandbox.files.write.call_args[0]
    assert args[0].endswith(".tar.gz")
    assert isinstance(args[1], (bytes, bytearray))
    mock_sandbox.commands.run.assert_called_once()
