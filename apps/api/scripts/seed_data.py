from __future__ import annotations

import json
import sys
from datetime import date
from decimal import Decimal
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

API_DIR = Path(__file__).resolve().parents[1]
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from app.db import SessionLocal
from app.models import BenchmarkStat, EmissionFactor, MethodologyVersion

ROOT_DIR = Path(__file__).resolve().parents[3]
DATA_DIR = ROOT_DIR / "data"


def load_json(filename: str) -> list[dict]:
    path = DATA_DIR / filename
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def upsert_emission_factors(db: Session, rows: list[dict]) -> int:
    count = 0
    for row in rows:
        existing = db.scalar(
            select(EmissionFactor).where(
                EmissionFactor.category == row["category"],
                EmissionFactor.region == row["region"],
                EmissionFactor.unit_activity == row["unit_activity"],
                EmissionFactor.valid_from == date.fromisoformat(row["valid_from"]),
            )
        )

        payload = {
            "category": row["category"],
            "region": row["region"],
            "unit_activity": row["unit_activity"],
            "factor_kgco2e_per_unit": Decimal(str(row["factor_kgco2e_per_unit"])),
            "valid_from": date.fromisoformat(row["valid_from"]),
            "valid_to": date.fromisoformat(row["valid_to"]) if row.get("valid_to") else None,
            "source_name": row["source_name"],
            "source_url": row["source_url"],
            "source_year": int(row["source_year"]),
            "license_notes": row.get("license_notes"),
            "is_placeholder": bool(row.get("is_placeholder", True)),
        }

        if existing:
            for key, value in payload.items():
                setattr(existing, key, value)
        else:
            db.add(EmissionFactor(**payload))
        count += 1

    return count


def upsert_methodologies(db: Session, rows: list[dict]) -> int:
    count = 0
    for row in rows:
        existing = db.scalar(
            select(MethodologyVersion).where(MethodologyVersion.version_name == row["version_name"])
        )

        payload = {
            "version_name": row["version_name"],
            "equation_string": row["equation_string"],
            "description": row.get("description"),
        }

        if existing:
            for key, value in payload.items():
                setattr(existing, key, value)
        else:
            db.add(MethodologyVersion(**payload))
        count += 1

    return count


def upsert_benchmark_stats(db: Session, rows: list[dict]) -> int:
    count = 0
    for row in rows:
        existing = db.scalar(
            select(BenchmarkStat).where(
                BenchmarkStat.metric == row["metric"],
                BenchmarkStat.region == row["region"],
                BenchmarkStat.year == int(row["year"]),
            )
        )

        payload = {
            "metric": row["metric"],
            "region": row["region"],
            "year": int(row["year"]),
            "value_tonnes_per_person": Decimal(str(row["value_tonnes_per_person"])),
            "source_name": row["source_name"],
            "source_url": row["source_url"],
        }

        if existing:
            for key, value in payload.items():
                setattr(existing, key, value)
        else:
            db.add(BenchmarkStat(**payload))
        count += 1

    return count


def main() -> None:
    emission_rows = load_json("db_emission_factors.json")
    methodology_rows = load_json("db_methodology_versions.json")
    benchmark_rows = load_json("db_benchmark_stats.json")

    with SessionLocal() as db:
        ef_count = upsert_emission_factors(db, emission_rows)
        methodology_count = upsert_methodologies(db, methodology_rows)
        benchmark_count = upsert_benchmark_stats(db, benchmark_rows)
        db.commit()

    print(
        "Seed complete: "
        f"emission_factors={ef_count}, "
        f"methodology_versions={methodology_count}, "
        f"benchmark_stats={benchmark_count}"
    )


if __name__ == "__main__":
    main()
