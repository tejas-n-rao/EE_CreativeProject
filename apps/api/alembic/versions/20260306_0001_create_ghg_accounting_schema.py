"""create ghg accounting schema

Revision ID: 20260306_0001
Revises:
Create Date: 2026-03-06 01:15:00

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260306_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "emission_factors",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("category", sa.String(length=120), nullable=False),
        sa.Column("region", sa.String(length=32), nullable=False),
        sa.Column("unit_activity", sa.String(length=64), nullable=False),
        sa.Column(
            "factor_kgco2e_per_unit", sa.Numeric(precision=14, scale=6), nullable=False
        ),
        sa.Column("valid_from", sa.Date(), nullable=False),
        sa.Column("valid_to", sa.Date(), nullable=True),
        sa.Column("source_name", sa.String(length=255), nullable=False),
        sa.Column("source_url", sa.String(length=512), nullable=False),
        sa.Column("source_year", sa.Integer(), nullable=False),
        sa.Column("license_notes", sa.Text(), nullable=True),
        sa.Column("is_placeholder", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "category",
            "region",
            "unit_activity",
            "valid_from",
            name="uq_emission_factors_category_region_unit_valid_from",
        ),
    )
    op.create_index(
        op.f("ix_emission_factors_category"), "emission_factors", ["category"], unique=False
    )
    op.create_index(
        op.f("ix_emission_factors_region"), "emission_factors", ["region"], unique=False
    )

    op.create_table(
        "methodology_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version_name", sa.String(length=120), nullable=False),
        sa.Column("equation_string", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("version_name"),
    )

    op.create_table(
        "surveys",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("country", sa.String(length=32), nullable=False),
        sa.Column("answers_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_surveys_country"), "surveys", ["country"], unique=False)

    op.create_table(
        "calculations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("survey_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("methodology_version_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("total_kgco2e", sa.Numeric(precision=18, scale=6), nullable=False),
        sa.Column("breakdown_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["methodology_version_id"], ["methodology_versions.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(["survey_id"], ["surveys.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "benchmark_stats",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("metric", sa.String(length=120), nullable=False),
        sa.Column("region", sa.String(length=32), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column(
            "value_tonnes_per_person", sa.Numeric(precision=12, scale=6), nullable=False
        ),
        sa.Column("source_name", sa.String(length=255), nullable=False),
        sa.Column("source_url", sa.String(length=512), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "metric", "region", "year", name="uq_benchmark_stats_metric_region_year"
        ),
    )


def downgrade() -> None:
    op.drop_table("benchmark_stats")
    op.drop_table("calculations")
    op.drop_index(op.f("ix_surveys_country"), table_name="surveys")
    op.drop_table("surveys")
    op.drop_table("methodology_versions")
    op.drop_index(op.f("ix_emission_factors_region"), table_name="emission_factors")
    op.drop_index(op.f("ix_emission_factors_category"), table_name="emission_factors")
    op.drop_table("emission_factors")
