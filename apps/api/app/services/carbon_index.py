from __future__ import annotations

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from sqlalchemy.orm import Session

from app.models import BenchmarkStat
from app.services.calculation_engine import CalculationEngineError, calculate_emissions

INDEX_QUANT = Decimal("0.01")


class CarbonIndexError(ValueError):
    pass


def _to_decimal(value: object, field_name: str) -> Decimal:
    try:
        result = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise CarbonIndexError(f"Invalid numeric value for {field_name}: {value}") from exc
    return result


def annual_footprint(monthly_footprint_kgco2e: Decimal | float | int) -> Decimal:
    monthly = _to_decimal(monthly_footprint_kgco2e, "monthly_footprint_kgco2e")
    if monthly < 0:
        raise CarbonIndexError("monthly_footprint_kgco2e must be >= 0")
    return (monthly * Decimal("12")).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def interpret_index(value: Decimal | float | int) -> str:
    score = _to_decimal(value, "index_value")
    if score < Decimal("70"):
        return "below average"
    if score <= Decimal("130"):
        return "around average"
    return "above average"


def calculate_carbon_index(
    *,
    monthly_footprint_kgco2e: Decimal | float | int,
    india_per_capita_emissions_tonnes: Decimal | float | int,
    world_per_capita_emissions_tonnes: Decimal | float | int,
) -> dict:
    annual_kg = annual_footprint(monthly_footprint_kgco2e)
    annual_tonnes = annual_kg / Decimal("1000")

    india_pc = _to_decimal(india_per_capita_emissions_tonnes, "india_per_capita_emissions_tonnes")
    world_pc = _to_decimal(world_per_capita_emissions_tonnes, "world_per_capita_emissions_tonnes")

    if india_pc <= 0:
        raise CarbonIndexError("india_per_capita_emissions_tonnes must be > 0")
    if world_pc <= 0:
        raise CarbonIndexError("world_per_capita_emissions_tonnes must be > 0")

    india_index = ((annual_tonnes / india_pc) * Decimal("100")).quantize(
        INDEX_QUANT, rounding=ROUND_HALF_UP
    )
    world_index = ((annual_tonnes / world_pc) * Decimal("100")).quantize(
        INDEX_QUANT, rounding=ROUND_HALF_UP
    )

    return {
        "india_index": india_index,
        "world_index": world_index,
        "interpretation": interpret_index(world_index),
    }


def _get_benchmark_value_tonnes(
    db: Session,
    *,
    region: str,
    metric: str = "annual_per_capita_emissions",
    year: int | None = None,
) -> Decimal:
    query = db.query(BenchmarkStat).filter(
        BenchmarkStat.metric == metric, BenchmarkStat.region == region
    )

    if year is not None:
        query = query.filter(BenchmarkStat.year == year)
    else:
        query = query.order_by(BenchmarkStat.year.desc())

    stat = query.first()
    if stat is None:
        if year is None:
            raise CarbonIndexError(f"No benchmark stat found for metric={metric}, region={region}")
        raise CarbonIndexError(
            f"No benchmark stat found for metric={metric}, region={region}, year={year}"
        )

    return Decimal(str(stat.value_tonnes_per_person))


def calculate_carbon_index_for_survey(
    db: Session,
    *,
    survey_answers: dict,
    survey_region: str,
    benchmark_year: int | None = None,
) -> dict:
    try:
        emissions_breakdown = calculate_emissions(
            db,
            survey_answers=survey_answers,
            survey_region=survey_region,
        )
    except CalculationEngineError as exc:
        raise CarbonIndexError(str(exc)) from exc

    india_benchmark = _get_benchmark_value_tonnes(db, region="IN", year=benchmark_year)
    world_benchmark = _get_benchmark_value_tonnes(db, region="WORLD", year=benchmark_year)

    return calculate_carbon_index(
        monthly_footprint_kgco2e=emissions_breakdown["total_kgco2e"],
        india_per_capita_emissions_tonnes=india_benchmark,
        world_per_capita_emissions_tonnes=world_benchmark,
    )
