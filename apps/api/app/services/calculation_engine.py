from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from sqlalchemy.orm import Session

from app.models import EmissionFactor
from app.services.emission_factor_sheet import (
    EmissionFactorSheetError,
    FactorSheetRow,
    find_sheet_row,
    load_factor_sheet_rows,
)

ROUNDING_QUANT = Decimal("0.0001")


class CalculationEngineError(ValueError):
    pass


@dataclass(frozen=True)
class ActivityData:
    category: str
    activity_value: Decimal
    activity_unit: str


@dataclass(frozen=True)
class ResolvedEmissionFactor:
    factor_kgco2e_per_unit: Decimal
    unit_activity: str
    source_name: str
    source_url: str
    source_year: int | None
    region: str
    is_custom_override: bool


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


def resolve_emission_factor(
    db: Session,
    *,
    category: str,
    activity_unit: str,
    region: str,
    as_of: date,
    sheet_rows: list[FactorSheetRow] | None = None,
) -> ResolvedEmissionFactor | None:
    rows = sheet_rows if sheet_rows is not None else load_factor_sheet_rows()
    custom_row = find_sheet_row(
        rows,
        category=category,
        unit_activity=activity_unit,
        region=region,
        require_custom_override=True,
    )
    if custom_row is not None and custom_row.custom_factor_kgco2e_per_unit is not None:
        return ResolvedEmissionFactor(
            factor_kgco2e_per_unit=custom_row.custom_factor_kgco2e_per_unit,
            unit_activity=custom_row.unit_activity,
            source_name=custom_row.custom_source_name
            or custom_row.default_source_name
            or "Custom Excel override",
            source_url=custom_row.custom_source_url or custom_row.default_source_url or "",
            source_year=custom_row.custom_source_year or custom_row.default_source_year,
            region=custom_row.region,
            is_custom_override=True,
        )

    factor = _find_best_factor(
        db,
        category=category,
        activity_unit=activity_unit,
        region=region,
        as_of=as_of,
    )
    if factor is not None:
        return ResolvedEmissionFactor(
            factor_kgco2e_per_unit=Decimal(str(factor.factor_kgco2e_per_unit)),
            unit_activity=factor.unit_activity,
            source_name=factor.source_name,
            source_url=factor.source_url,
            source_year=factor.source_year,
            region=factor.region,
            is_custom_override=False,
        )

    default_row = find_sheet_row(
        rows,
        category=category,
        unit_activity=activity_unit,
        region=region,
        require_custom_override=False,
    )
    if default_row is not None:
        return ResolvedEmissionFactor(
            factor_kgco2e_per_unit=default_row.default_factor_kgco2e_per_unit,
            unit_activity=default_row.unit_activity,
            source_name=default_row.default_source_name,
            source_url=default_row.default_source_url,
            source_year=default_row.default_source_year,
            region=default_row.region,
            is_custom_override=False,
        )

    return None


def calculate_emissions(
    db: Session,
    *,
    survey_answers: dict,
    survey_region: str,
    as_of: date | None = None,
) -> dict:
    effective_date = as_of or date.today()
    try:
        sheet_rows = load_factor_sheet_rows()
    except EmissionFactorSheetError as exc:
        raise CalculationEngineError(str(exc)) from exc

    # 1) Extract activity data from survey answers.
    activity_rows = extract_activity_data(survey_answers)

    lines: list[dict] = []
    total_kgco2e = Decimal("0")

    for activity in activity_rows:
        # 2) Match activity category to emission factor.
        resolved_factor = resolve_emission_factor(
            db,
            category=activity.category,
            activity_unit=activity.activity_unit,
            region=survey_region,
            as_of=effective_date,
            sheet_rows=sheet_rows,
        )
        if resolved_factor is None:
            raise CalculationEngineError(
                f"No emission factor found for category={activity.category}, "
                "unit="
                f"{activity.activity_unit}, region={survey_region}, "
                f"as_of={effective_date.isoformat()}"
            )

        emission_factor = resolved_factor.factor_kgco2e_per_unit

        # 3) Calculate emissions per category: Emissions = Activity × Emission Factor.
        result_kgco2e = (activity.activity_value * emission_factor).quantize(
            ROUNDING_QUANT, rounding=ROUND_HALF_UP
        )

        factor_unit = f"kgCO2e/{resolved_factor.unit_activity}"
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
