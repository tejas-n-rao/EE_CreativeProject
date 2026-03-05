from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class EmissionFactorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    category: str
    region: str
    unit_activity: str
    factor_kgco2e_per_unit: Decimal
    valid_from: date
    valid_to: date | None
    source_name: str
    source_url: str
    source_year: int
    license_notes: str | None
    is_placeholder: bool
    created_at: datetime


class SurveyCreate(BaseModel):
    country: str = Field(min_length=2, max_length=32)
    answers_json: dict


class SurveyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    country: str
    answers_json: dict
    created_at: datetime


class CalculationCreate(BaseModel):
    survey_id: UUID
    methodology_version_id: UUID
    total_kgco2e: Decimal = Field(gt=0)
    breakdown_json: dict


class CalculationPreviewRequest(BaseModel):
    survey_id: UUID
    as_of: date | None = None


class CalculationRunRequest(BaseModel):
    survey_id: UUID
    methodology_version_id: UUID
    as_of: date | None = None


class EmissionCalculationLine(BaseModel):
    category: str
    activity_value: Decimal
    activity_unit: str
    emission_factor: Decimal
    factor_unit: str
    result_kgco2e: Decimal
    formula_string: str


class EmissionCalculationResult(BaseModel):
    total_kgco2e: Decimal
    lines: list[EmissionCalculationLine]


class CalculationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    survey_id: UUID
    methodology_version_id: UUID
    total_kgco2e: Decimal
    breakdown_json: dict
    created_at: datetime


class MethodologyVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    version_name: str
    equation_string: str
    description: str | None
    created_at: datetime


class BenchmarkStatOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    metric: str
    region: str
    year: int
    value_tonnes_per_person: Decimal
    source_name: str
    source_url: str
