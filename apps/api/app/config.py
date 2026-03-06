from __future__ import annotations

import os
from pathlib import Path


class Settings:
    _default_sqlite_path = Path(__file__).resolve().parents[1] / "carbon.db"
    database_url: str = os.getenv(
        "DATABASE_URL", f"sqlite+pysqlite:///{_default_sqlite_path}"
    )


settings = Settings()
