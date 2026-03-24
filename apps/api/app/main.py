from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import text
from sqlalchemy.orm import Session

from .db import get_db
from .models import BenchmarkStat, Calculation, EmissionFactor, MethodologyVersion, Survey
from .schemas import (
    BenchmarkStatOut,
    CalculationCreate,
    CalculationOut,
    CalculationPreviewRequest,
    CalculationRunRequest,
    CarbonIndexPreviewRequest,
    CarbonIndexResult,
    DashboardResponse,
    EmissionCalculationResult,
    EmissionFactorCurrentOut,
    EmissionFactorOut,
    FactOut,
    MethodologyVersionOut,
    SurveyCalculateRequest,
    SurveyCalculateResponse,
    SurveyCreate,
    SurveyOut,
)
from .services.calculation_engine import CalculationEngineError, calculate_emissions
from .services.calculation_engine import resolve_emission_factor
from .services.carbon_index import (
    CarbonIndexError,
    calculate_carbon_index,
    calculate_carbon_index_for_survey,
    get_benchmarks_for_index,
)
from .services.emission_factor_sheet import EmissionFactorSheetError, load_factor_sheet_rows
from .services.facts import FactsError, load_fact_templates, render_fact_templates

app = FastAPI(title="Carbon Calculator API", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _query_benchmarks(
    db: Session,
    *,
    metric: str | None = None,
    region: str | None = None,
    year: int | None = None,
) -> list[BenchmarkStat]:
    query = db.query(BenchmarkStat)

    if metric:
        query = query.filter(BenchmarkStat.metric == metric)
    if region:
        query = query.filter(BenchmarkStat.region == region)
    if year is not None:
        query = query.filter(BenchmarkStat.year == year)

    return query.order_by(BenchmarkStat.year.desc(), BenchmarkStat.metric.asc()).all()


def _get_methodology_for_calculation(
    db: Session, methodology_version_id: UUID | None
) -> MethodologyVersion:
    if methodology_version_id is not None:
        methodology = db.get(MethodologyVersion, methodology_version_id)
        if methodology is None:
            raise HTTPException(status_code=404, detail="Methodology version not found")
        return methodology

    methodology = (
        db.query(MethodologyVersion)
        .order_by(MethodologyVersion.created_at.desc(), MethodologyVersion.version_name.desc())
        .first()
    )
    if methodology is None:
        raise HTTPException(status_code=404, detail="No methodology versions available")

    return methodology


def _json_serialize(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, dict):
        return {key: _json_serialize(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_json_serialize(item) for item in value]
    return value


def _calculate_index_from_monthly(
    db: Session,
    *,
    monthly_footprint_kgco2e: Decimal,
    benchmark_year: int | None = None,
) -> dict:
    benchmarks = get_benchmarks_for_index(db, benchmark_year=benchmark_year)
    return calculate_carbon_index(
        monthly_footprint_kgco2e=monthly_footprint_kgco2e,
        india_per_capita_emissions_tonnes=benchmarks["india_per_capita_emissions_tonnes"],
        world_per_capita_emissions_tonnes=benchmarks["world_per_capita_emissions_tonnes"],
    )


def _load_rendered_facts(
    *, total_kgco2e: Decimal | None, world_index: Decimal | None
) -> list[FactOut]:
    try:
        templates = load_fact_templates()
    except FactsError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    rendered = render_fact_templates(
        templates,
        total_kgco2e=total_kgco2e,
        world_index=world_index,
    )
    return [FactOut(**item) for item in rendered]


def _create_calculation_row(
    db: Session,
    *,
    survey: Survey,
    methodology: MethodologyVersion,
    breakdown: dict,
) -> Calculation:
    calculation = Calculation(
        survey_id=survey.id,
        methodology_version_id=methodology.id,
        total_kgco2e=breakdown["total_kgco2e"],
        breakdown_json=_json_serialize(breakdown),
    )
    db.add(calculation)
    db.commit()
    db.refresh(calculation)
    return calculation


@app.get("/health")
def health(db: Session = Depends(get_db)) -> dict[str, str]:
    db.execute(text("SELECT 1"))
    return {"status": "ok"}


@app.get("/emission-factors", response_model=list[EmissionFactorOut])
def list_emission_factors(
    category: str | None = None,
    region: str | None = None,
    as_of: date | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[EmissionFactor]:
    query = db.query(EmissionFactor)

    if category:
        query = query.filter(EmissionFactor.category == category)
    if region:
        query = query.filter(EmissionFactor.region == region)
    if as_of:
        query = query.filter(EmissionFactor.valid_from <= as_of).filter(
            (EmissionFactor.valid_to.is_(None)) | (EmissionFactor.valid_to >= as_of)
        )

    return query.order_by(
        EmissionFactor.category, EmissionFactor.region, EmissionFactor.valid_from
    ).all()


@app.get("/methodology-versions", response_model=list[MethodologyVersionOut])
def list_methodology_versions(db: Session = Depends(get_db)) -> list[MethodologyVersion]:
    return db.query(MethodologyVersion).order_by(MethodologyVersion.created_at.desc()).all()


@app.post("/surveys", response_model=SurveyOut, status_code=201)
def create_survey(payload: SurveyCreate, db: Session = Depends(get_db)) -> Survey:
    survey = Survey(country=payload.country, answers_json=payload.answers_json)
    db.add(survey)
    db.commit()
    db.refresh(survey)
    return survey


@app.post("/calculations", response_model=CalculationOut, status_code=201)
def create_calculation(payload: CalculationCreate, db: Session = Depends(get_db)) -> Calculation:
    survey = db.get(Survey, payload.survey_id)
    if survey is None:
        raise HTTPException(status_code=404, detail="Survey not found")

    methodology = db.get(MethodologyVersion, payload.methodology_version_id)
    if methodology is None:
        raise HTTPException(status_code=404, detail="Methodology version not found")

    calculation = Calculation(
        survey_id=payload.survey_id,
        methodology_version_id=payload.methodology_version_id,
        total_kgco2e=payload.total_kgco2e,
        breakdown_json=payload.breakdown_json,
    )
    db.add(calculation)
    db.commit()
    db.refresh(calculation)
    return calculation


@app.post("/calculations/preview", response_model=EmissionCalculationResult)
def preview_calculation(
    payload: CalculationPreviewRequest, db: Session = Depends(get_db)
) -> EmissionCalculationResult:
    survey = db.get(Survey, payload.survey_id)
    if survey is None:
        raise HTTPException(status_code=404, detail="Survey not found")

    try:
        result = calculate_emissions(
            db,
            survey_answers=survey.answers_json,
            survey_region=survey.country,
            as_of=payload.as_of,
        )
    except CalculationEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return EmissionCalculationResult(**result)


@app.post("/calculations/run", response_model=CalculationOut, status_code=201)
def run_calculation(payload: CalculationRunRequest, db: Session = Depends(get_db)) -> Calculation:
    survey = db.get(Survey, payload.survey_id)
    if survey is None:
        raise HTTPException(status_code=404, detail="Survey not found")

    methodology = db.get(MethodologyVersion, payload.methodology_version_id)
    if methodology is None:
        raise HTTPException(status_code=404, detail="Methodology version not found")

    try:
        breakdown = calculate_emissions(
            db,
            survey_answers=survey.answers_json,
            survey_region=survey.country,
            as_of=payload.as_of,
        )
    except CalculationEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return _create_calculation_row(
        db,
        survey=survey,
        methodology=methodology,
        breakdown=breakdown,
    )


@app.get("/benchmark-stats", response_model=list[BenchmarkStatOut])
def list_benchmark_stats(
    metric: str | None = None,
    region: str | None = None,
    year: int | None = None,
    db: Session = Depends(get_db),
) -> list[BenchmarkStat]:
    return _query_benchmarks(db, metric=metric, region=region, year=year)


@app.post("/carbon-index/preview", response_model=CarbonIndexResult)
def preview_carbon_index(
    payload: CarbonIndexPreviewRequest, db: Session = Depends(get_db)
) -> CarbonIndexResult:
    survey = db.get(Survey, payload.survey_id)
    if survey is None:
        raise HTTPException(status_code=404, detail="Survey not found")

    try:
        result = calculate_carbon_index_for_survey(
            db,
            survey_answers=survey.answers_json,
            survey_region=survey.country,
            benchmark_year=payload.benchmark_year,
        )
    except CarbonIndexError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return CarbonIndexResult(**result)


@app.post("/v1/surveys", response_model=SurveyOut, status_code=201)
def create_survey_v1(payload: SurveyCreate, db: Session = Depends(get_db)) -> Survey:
    survey = Survey(country=payload.country, answers_json=payload.answers_json)
    db.add(survey)
    db.commit()
    db.refresh(survey)
    return survey


@app.post("/v1/surveys/{survey_id}/calculate", response_model=SurveyCalculateResponse)
def calculate_survey_v1(
    survey_id: UUID,
    payload: SurveyCalculateRequest | None = None,
    db: Session = Depends(get_db),
) -> SurveyCalculateResponse:
    survey = db.get(Survey, survey_id)
    if survey is None:
        raise HTTPException(status_code=404, detail="Survey not found")

    request = payload or SurveyCalculateRequest()
    methodology = _get_methodology_for_calculation(db, request.methodology_version_id)

    try:
        breakdown = calculate_emissions(
            db,
            survey_answers=survey.answers_json,
            survey_region=survey.country,
            as_of=request.as_of,
        )
        carbon_index = _calculate_index_from_monthly(
            db,
            monthly_footprint_kgco2e=breakdown["total_kgco2e"],
            benchmark_year=request.benchmark_year,
        )
    except (CalculationEngineError, CarbonIndexError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    calculation = _create_calculation_row(
        db,
        survey=survey,
        methodology=methodology,
        breakdown=breakdown,
    )

    return SurveyCalculateResponse(
        survey=SurveyOut.model_validate(survey),
        calculation=CalculationOut.model_validate(calculation),
        carbon_index=CarbonIndexResult(**carbon_index),
    )


@app.get("/v1/surveys/{survey_id}/dashboard", response_model=DashboardResponse)
def survey_dashboard_v1(survey_id: UUID, db: Session = Depends(get_db)) -> DashboardResponse:
    survey = db.get(Survey, survey_id)
    if survey is None:
        raise HTTPException(status_code=404, detail="Survey not found")

    calculation = (
        db.query(Calculation)
        .filter(Calculation.survey_id == survey_id)
        .order_by(Calculation.created_at.desc())
        .first()
    )

    carbon_index_result: CarbonIndexResult | None = None
    monthly_total: Decimal | None = None
    if calculation is not None:
        monthly_total = Decimal(str(calculation.total_kgco2e))
        try:
            carbon_index_payload = _calculate_index_from_monthly(
                db,
                monthly_footprint_kgco2e=monthly_total,
            )
            carbon_index_result = CarbonIndexResult(**carbon_index_payload)
        except CarbonIndexError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    benchmarks = _query_benchmarks(db)
    facts = _load_rendered_facts(
        total_kgco2e=monthly_total,
        world_index=carbon_index_result.world_index if carbon_index_result else None,
    )

    return DashboardResponse(
        survey=SurveyOut.model_validate(survey),
        calculation=CalculationOut.model_validate(calculation) if calculation else None,
        carbon_index=carbon_index_result,
        benchmarks=[BenchmarkStatOut.model_validate(item) for item in benchmarks],
        facts=facts,
    )


@app.get("/v1/benchmarks", response_model=list[BenchmarkStatOut])
def list_benchmarks_v1(
    metric: str | None = None,
    region: str | None = None,
    year: int | None = None,
    db: Session = Depends(get_db),
) -> list[BenchmarkStat]:
    return _query_benchmarks(db, metric=metric, region=region, year=year)


@app.get("/v1/emission-factors/current", response_model=list[EmissionFactorCurrentOut])
def list_current_emission_factors_v1(
    as_of: date | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[EmissionFactorCurrentOut]:
    effective_date = as_of or date.today()
    try:
        sheet_rows = load_factor_sheet_rows()
    except EmissionFactorSheetError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    results: list[EmissionFactorCurrentOut] = []

    for row in sheet_rows:
        resolved = resolve_emission_factor(
            db,
            category=row.category,
            activity_unit=row.unit_activity,
            region=row.region,
            as_of=effective_date,
            sheet_rows=sheet_rows,
        )
        if resolved is None:
            continue

        results.append(
            EmissionFactorCurrentOut(
                activity_name=row.activity_name,
                category=row.category,
                region=row.region,
                unit_activity=row.unit_activity,
                effective_factor_kgco2e_per_unit=resolved.factor_kgco2e_per_unit,
                effective_source_name=resolved.source_name,
                effective_source_url=resolved.source_url,
                effective_source_year=resolved.source_year,
                uses_custom_override=resolved.is_custom_override,
                default_factor_kgco2e_per_unit=row.default_factor_kgco2e_per_unit,
                default_source_name=row.default_source_name,
                default_source_url=row.default_source_url,
                default_source_year=row.default_source_year,
                custom_factor_kgco2e_per_unit=row.custom_factor_kgco2e_per_unit,
                custom_source_name=row.custom_source_name,
                custom_source_url=row.custom_source_url,
                custom_source_year=row.custom_source_year,
            )
        )

    return sorted(results, key=lambda item: (item.activity_name.lower(), item.region, item.category))


@app.get("/v1/methodology", response_model=list[MethodologyVersionOut])
def list_methodology_v1(db: Session = Depends(get_db)) -> list[MethodologyVersion]:
    try:
        return db.query(MethodologyVersion).order_by(MethodologyVersion.created_at.desc()).all()
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Methodology data is unavailable. "
                "Run `alembic upgrade head` and `python scripts/seed_data.py`."
            ),
        ) from exc


@app.get("/v1/facts", response_model=list[FactOut])
def list_facts_v1() -> list[FactOut]:
    return _load_rendered_facts(total_kgco2e=None, world_index=None)
