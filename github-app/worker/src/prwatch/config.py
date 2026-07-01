from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = Field(validation_alias="DATABASE_URL")
    worker_id: str = Field(default="worker-1", validation_alias="PRWATCH_WORKER_ID")
    max_concurrency: int = Field(default=4, validation_alias="PRWATCH_MAX_CONCURRENCY")
    github_app_id: int = Field(default=0, validation_alias="GITHUB_APP_ID")
    github_app_private_key: str = Field(default="", validation_alias="GITHUB_APP_PRIVATE_KEY")
    e2b_api_key: str = Field(default="", validation_alias="E2B_API_KEY")
    omp_command: str = Field(default="omp", validation_alias="PRWATCH_OMP_COMMAND")
    workspace_root: str = Field(default="/data/workspaces", validation_alias="PRWATCH_WORKSPACE_ROOT")


def get_settings() -> Settings:
    return Settings()