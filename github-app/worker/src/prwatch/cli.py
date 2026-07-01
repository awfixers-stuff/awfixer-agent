from __future__ import annotations

import asyncio
import logging

import click

from prwatch.config import get_settings
from prwatch.runner import run_worker_loop


@click.group()
def main() -> None:
    """prwatch worker — claims review jobs from Postgres on Railway."""


@main.command("worker")
def worker_cmd() -> None:
    """Run the review job consumer (LISTEN/NOTIFY + claim loop)."""
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    settings = get_settings()
    asyncio.run(run_worker_loop(settings))


if __name__ == "__main__":
    main()