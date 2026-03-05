from __future__ import annotations

import os


class Settings:
    database_url: str = os.getenv("DATABASE_URL", "sqlite+pysqlite:///./carbon.db")


settings = Settings()
