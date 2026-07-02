from __future__ import annotations

from functools import cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ThinkingLevel = Literal["off", "low", "medium", "high", "xhigh"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = Field(validation_alias="DATABASE_URL")
    worker_id: str = Field(default="worker-1", validation_alias="PRWATCH_WORKER_ID")
    max_concurrency: int = Field(default=4, validation_alias="PRWATCH_MAX_CONCURRENCY")
    github_app_id: int = Field(default=0, validation_alias="GITHUB_APP_ID")
    github_app_private_key: str = Field(default="", validation_alias="GITHUB_APP_PRIVATE_KEY")
    e2b_api_key: str = Field(default="", validation_alias="E2B_API_KEY")
    kernel_api_key: str = Field(default="", validation_alias="KERNEL_API_KEY")
    omp_command: str = Field(default="agent", validation_alias="PRWATCH_OMP_COMMAND")
    workspace_root: str = Field(default="/data/workspaces", validation_alias="PRWATCH_WORKSPACE_ROOT")
    model: str = Field(default="anthropic/claude-sonnet-4-6", validation_alias="PRWATCH_MODEL")
    provider: str | None = Field(default=None, validation_alias="PRWATCH_PROVIDER")
    thinking: ThinkingLevel = Field(default="high", validation_alias="PRWATCH_THINKING")
    task_timeout_seconds: float = Field(default=2400.0, validation_alias="PRWATCH_TASK_TIMEOUT_SECONDS")
    request_timeout_seconds: float = Field(default=120.0, validation_alias="PRWATCH_REQUEST_TIMEOUT_SECONDS")
    stub_pipeline: bool = Field(default=False, validation_alias="PRWATCH_STUB_PIPELINE")


@cache
def get_settings() -> Settings:
    return Settings()
