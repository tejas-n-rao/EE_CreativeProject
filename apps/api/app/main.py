from __future__ import annotations

from datetime import date

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from .db import get_db
from .models import BenchmarkStat, Calculation, EmissionFactor, MethodologyVersion, Survey
from .schemas import (
    BenchmarkStatOut,
    CalculationCreate,
    CalculationPreviewRequest,
    CalculationRunRequest,
    CalculationOut,
    EmissionCalculationResult,
    EmissionFactorOut,
    MethodologyVersionOut,
    SurveyCreate,
    SurveyOut,
)
from .services.calculation_engine import CalculationEngineError, calculate_emissions

app = FastAPI(title="Carbon Calculator API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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

    calculation = Calculation(
        survey_id=payload.survey_id,
        methodology_version_id=payload.methodology_version_id,
        total_kgco2e=breakdown["total_kgco2e"],
        breakdown_json=breakdown,
    )
    db.add(calculation)
    db.commit()
    db.refresh(calculation)
    return calculation


@app.get("/benchmark-stats", response_model=list[BenchmarkStatOut])
def list_benchmark_stats(
    metric: str | None = None,
    region: str | None = None,
    year: int | None = None,
    db: Session = Depends(get_db),
) -> list[BenchmarkStat]:
    query = db.query(BenchmarkStat)

    if metric:
        query = query.filter(BenchmarkStat.metric == metric)
    if region:
        query = query.filter(BenchmarkStat.region == region)
    if year is not None:
        query = query.filter(BenchmarkStat.year == year)

    return query.order_by(BenchmarkStat.year.desc(), BenchmarkStat.metric.asc()).all()
