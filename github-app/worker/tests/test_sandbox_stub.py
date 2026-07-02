import pytest

from prwatch.sandbox_exec import StubSandboxRunner, build_sandbox_runner


@pytest.mark.asyncio
async def test_stub_sandbox_refuses_command() -> None:
    runner = build_sandbox_runner("")
    assert isinstance(runner, StubSandboxRunner)
    out = await runner.run("npm test")
    assert out.exit_code == 0
    assert "stub sandbox" in out.stdout
