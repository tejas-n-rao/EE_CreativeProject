from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from sqlalchemy.orm import Session

from app.models import EmissionFactor

ROUNDING_QUANT = Decimal("0.0001")


class CalculationEngineError(ValueError):
    pass


@dataclass(frozen=True)
class ActivityData:
    category: str
    activity_value: Decimal
    activity_unit: str


def _to_decimal(value: object, field: str) -> Decimal:
    try:
        result = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise CalculationEngineError(f"Invalid numeric value for '{field}': {value}") from exc

    if result <= 0:
        raise CalculationEngineError(f"'{field}' must be greater than 0")

    return result


def _format_decimal(value: Decimal) -> str:
    normalized = value.normalize()
    as_text = format(normalized, "f")
    if "." in as_text:
        as_text = as_text.rstrip("0").rstrip(".")
    return as_text or "0"


def extract_activity_data(answers_json: dict) -> list[ActivityData]:
    if not isinstance(answers_json, dict):
        raise CalculationEngineError("Survey answers must be a JSON object")

    records: list[ActivityData] = []

    activities = answers_json.get("activities")
    if activities is not None:
        if not isinstance(activities, list):
            raise CalculationEngineError("answers_json.activities must be a list")

        for index, item in enumerate(activities):
            if not isinstance(item, dict):
                raise CalculationEngineError(f"activities[{index}] must be an object")

            category = item.get("category")
            unit = item.get("unit")
            if not isinstance(category, str) or not category.strip():
                raise CalculationEngineError(
                    f"activities[{index}].category must be a non-empty string"
                )
            if not isinstance(unit, str) or not unit.strip():
                raise CalculationEngineError(
                    f"activities[{index}].unit must be a non-empty string"
                )

            value = _to_decimal(item.get("value"), f"activities[{index}].value")
            records.append(
                ActivityData(
                    category=category.strip(),
                    activity_value=value,
                    activity_unit=unit.strip(),
                )
            )

        return records

    # Fallback shape: {"electricity": {"value": 100, "unit": "kWh"}, ...}
    for category in sorted(answers_json.keys()):
        payload = answers_json[category]
        if not isinstance(payload, dict):
            continue
        if "value" not in payload or "unit" not in payload:
            continue

        unit = payload["unit"]
        if not isinstance(unit, str) or not unit.strip():
            raise CalculationEngineError(f"'{category}.unit' must be a non-empty string")

        value = _to_decimal(payload["value"], f"{category}.value")
        records.append(
            ActivityData(
                category=category.strip(),
                activity_value=value,
                activity_unit=unit.strip(),
            )
        )

    if not records:
        raise CalculationEngineError(
            "No activity data found. Provide answers_json.activities "
            "or category objects with value/unit."
        )

    return records


def _find_best_factor(
    db: Session,
    *,
    category: str,
    activity_unit: str,
    region: str,
    as_of: date,
) -> EmissionFactor | None:
    regions_to_try: list[str] = []
    if region:
        regions_to_try.append(region)
    if "WORLD" not in regions_to_try:
        regions_to_try.append("WORLD")

    for candidate_region in regions_to_try:
        factor = (
            db.query(EmissionFactor)
            .filter(EmissionFactor.category == category)
            .filter(EmissionFactor.unit_activity == activity_unit)
            .filter(EmissionFactor.region == candidate_region)
            .filter(EmissionFactor.valid_from <= as_of)
            .filter((EmissionFactor.valid_to.is_(None)) | (EmissionFactor.valid_to >= as_of))
            .order_by(EmissionFactor.valid_from.desc(), EmissionFactor.created_at.desc())
            .first()
        )
        if factor is not None:
            return factor

    return None


def calculate_emissions(
    db: Session,
    *,
    survey_answers: dict,
    survey_region: str,
    as_of: date | None = None,
) -> dict:
    effective_date = as_of or date.today()

    # 1) Extract activity data from survey answers.
    activity_rows = extract_activity_data(survey_answers)

    lines: list[dict] = []
    total_kgco2e = Decimal("0")

    for activity in activity_rows:
        # 2) Match activity category to emission factor.
        factor = _find_best_factor(
            db,
            category=activity.category,
            activity_unit=activity.activity_unit,
            region=survey_region,
            as_of=effective_date,
        )
        if factor is None:
            raise CalculationEngineError(
                f"No emission factor found for category={activity.category}, "
                "unit="
                f"{activity.activity_unit}, region={survey_region}, "
                f"as_of={effective_date.isoformat()}"
            )

        emission_factor = Decimal(str(factor.factor_kgco2e_per_unit))

        # 3) Calculate emissions per category: Emissions = Activity × Emission Factor.
        result_kgco2e = (activity.activity_value * emission_factor).quantize(
            ROUNDING_QUANT, rounding=ROUND_HALF_UP
        )

        factor_unit = f"kgCO2e/{factor.unit_activity}"
        formula_string = (
            f"{_format_decimal(activity.activity_value)} {activity.activity_unit} × "
            f"{_format_decimal(emission_factor)} {factor_unit} = "
            f"{_format_decimal(result_kgco2e)} kgCO2e"
        )

        lines.append(
            {
                "category": activity.category,
                "activity_value": activity.activity_value,
                "activity_unit": activity.activity_unit,
                "emission_factor": emission_factor,
                "factor_unit": factor_unit,
                "result_kgco2e": result_kgco2e,
                "formula_string": formula_string,
            }
        )

        # 4) Aggregate totals.
        total_kgco2e += result_kgco2e

    total_kgco2e = total_kgco2e.quantize(ROUNDING_QUANT, rounding=ROUND_HALF_UP)
    return {
        "total_kgco2e": total_kgco2e,
        "lines": lines,
    }
