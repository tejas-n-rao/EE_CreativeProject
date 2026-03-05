from __future__ import annotations

import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="Carbon Calculator API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ROOT_DIR = Path(__file__).resolve().parents[3]
DATA_DIR = ROOT_DIR / "data"


class EstimateRequest(BaseModel):
    activity: str = Field(examples=["electricity"])
    amount: float = Field(gt=0, examples=[250])
    unit: str = Field(examples=["kWh"])


class EstimateResponse(BaseModel):
    activity: str
    amount: float
    unit: str
    factor_kg_co2e_per_unit: float
    total_kg_co2e: float
    source_note: str


def load_seed_file(filename: str) -> list[dict]:
    path = DATA_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"Seed file not found: {path}")

    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/seed/{dataset}")
def get_seed(dataset: str) -> list[dict]:
    filename = f"{dataset}.json"
    try:
        return load_seed_file(filename)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/estimate", response_model=EstimateResponse)
def estimate(request: EstimateRequest) -> EstimateResponse:
    factors = load_seed_file("emission_factors.json")
    match = next(
        (
            item
            for item in factors
            if item["activity"].lower() == request.activity.lower()
            and item["unit"].lower() == request.unit.lower()
        ),
        None,
    )

    if not match:
        raise HTTPException(
            status_code=400,
            detail=f"No factor found for activity={request.activity}, unit={request.unit}",
        )

    factor = float(match["factor_kg_co2e_per_unit"])
    total = round(request.amount * factor, 4)

    return EstimateResponse(
        activity=request.activity,
        amount=request.amount,
        unit=request.unit,
        factor_kg_co2e_per_unit=factor,
        total_kg_co2e=total,
        source_note="Placeholder seed factor; replace with validated datasets for production use.",
    )
