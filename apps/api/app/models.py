from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class EmissionFactor(Base):
    __tablename__ = "emission_factors"
    __table_args__ = (
        UniqueConstraint(
            "category",
            "region",
            "unit_activity",
            "valid_from",
            name="uq_emission_factors_category_region_unit_valid_from",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    category: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    region: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    unit_activity: Mapped[str] = mapped_column(String(64), nullable=False)
    factor_kgco2e_per_unit: Mapped[Decimal] = mapped_column(Numeric(14, 6), nullable=False)
    valid_from: Mapped[date] = mapped_column(Date, nullable=False)
    valid_to: Mapped[date | None] = mapped_column(Date)
    source_name: Mapped[str] = mapped_column(String(255), nullable=False)
    source_url: Mapped[str] = mapped_column(String(512), nullable=False)
    source_year: Mapped[int] = mapped_column(Integer, nullable=False)
    license_notes: Mapped[str | None] = mapped_column(Text)
    is_placeholder: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class MethodologyVersion(Base):
    __tablename__ = "methodology_versions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    version_name: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    equation_string: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    calculations: Mapped[list[Calculation]] = relationship(back_populates="methodology_version")


class Survey(Base):
    __tablename__ = "surveys"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    country: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    answers_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    calculations: Mapped[list[Calculation]] = relationship(back_populates="survey")


class Calculation(Base):
    __tablename__ = "calculations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    survey_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("surveys.id", ondelete="CASCADE"), nullable=False
    )
    methodology_version_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("methodology_versions.id", ondelete="RESTRICT"), nullable=False
    )
    total_kgco2e: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    breakdown_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    survey: Mapped[Survey] = relationship(back_populates="calculations")
    methodology_version: Mapped[MethodologyVersion] = relationship(back_populates="calculations")


class BenchmarkStat(Base):
    __tablename__ = "benchmark_stats"
    __table_args__ = (
        UniqueConstraint("metric", "region", "year", name="uq_benchmark_stats_metric_region_year"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    metric: Mapped[str] = mapped_column(String(120), nullable=False)
    region: Mapped[str] = mapped_column(String(32), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    value_tonnes_per_person: Mapped[Decimal] = mapped_column(Numeric(12, 6), nullable=False)
    source_name: Mapped[str] = mapped_column(String(255), nullable=False)
    source_url: Mapped[str] = mapped_column(String(512), nullable=False)
