from __future__ import annotations

import sys
import os
import tempfile
import unittest
from datetime import date
from decimal import Decimal
from pathlib import Path

from openpyxl import Workbook
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

from app.db import Base  # noqa: E402
from app.models import EmissionFactor  # noqa: E402
from app.services.calculation_engine import (  # noqa: E402
    CalculationEngineError,
    calculate_emissions,
    extract_activity_data,
)


class CalculationEngineTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite+pysqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.session_factory = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.db: Session = self.session_factory()
        self._seed_factors()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def _seed_factors(self) -> None:
        self.db.add_all(
            [
                EmissionFactor(
                    category="petrol_car_km",
                    region="IN",
                    unit_activity="km",
                    factor_kgco2e_per_unit=Decimal("0.21"),
                    valid_from=date(2024, 1, 1),
                    valid_to=None,
                    source_name="Test source",
                    source_url="https://example.org/test-source-car",
                    source_year=2024,
                    license_notes="Test-only",
                    is_placeholder=True,
                ),
                EmissionFactor(
                    category="electricity",
                    region="IN",
                    unit_activity="kWh",
                    factor_kgco2e_per_unit=Decimal("0.70"),
                    valid_from=date(2024, 1, 1),
                    valid_to=None,
                    source_name="Test source",
                    source_url="https://example.org/test-source-grid",
                    source_year=2024,
                    license_notes="Test-only",
                    is_placeholder=True,
                ),
                EmissionFactor(
                    category="flight_shorthaul",
                    region="WORLD",
                    unit_activity="passenger_km",
                    factor_kgco2e_per_unit=Decimal("0.158"),
                    valid_from=date(2024, 1, 1),
                    valid_to=None,
                    source_name="Test source",
                    source_url="https://example.org/test-source-flight",
                    source_year=2024,
                    license_notes="Test-only",
                    is_placeholder=True,
                ),
            ]
        )
        self.db.commit()

    def test_calculate_emissions_returns_expected_lines_and_total(self) -> None:
        survey_answers = {
            "activities": [
                {"category": "petrol_car_km", "value": 200, "unit": "km"},
                {"category": "electricity", "value": 50, "unit": "kWh"},
            ]
        }

        result = calculate_emissions(
            self.db,
            survey_answers=survey_answers,
            survey_region="IN",
            as_of=date(2025, 1, 1),
        )

        self.assertEqual(result["total_kgco2e"], Decimal("77.0000"))
        self.assertEqual(len(result["lines"]), 2)
        self.assertEqual(
            result["lines"][0]["formula_string"],
            "200 km × 0.21 kgCO2e/km = 42 kgCO2e",
        )
        self.assertEqual(
            result["lines"][1]["formula_string"],
            "50 kWh × 0.7 kgCO2e/kWh = 35 kgCO2e",
        )

    def test_calculate_emissions_falls_back_to_world_factor(self) -> None:
        survey_answers = {
            "activities": [
                {"category": "flight_shorthaul", "value": 100, "unit": "passenger_km"},
            ]
        }

        result = calculate_emissions(
            self.db,
            survey_answers=survey_answers,
            survey_region="IN",
            as_of=date(2025, 1, 1),
        )

        self.assertEqual(result["total_kgco2e"], Decimal("15.8000"))
        self.assertEqual(
            result["lines"][0]["formula_string"],
            "100 passenger_km × 0.158 kgCO2e/passenger_km = 15.8 kgCO2e",
        )

    def test_extract_activity_data_supports_mapping_shape(self) -> None:
        answers = {
            "electricity": {"value": "120.5", "unit": "kWh"},
            "petrol_car_km": {"value": 70, "unit": "km"},
            "ignored": "not-an-activity",
        }

        rows = extract_activity_data(answers)

        self.assertEqual([row.category for row in rows], ["electricity", "petrol_car_km"])
        self.assertEqual(rows[0].activity_value, Decimal("120.5"))
        self.assertEqual(rows[1].activity_value, Decimal("70"))

    def test_calculate_emissions_raises_when_factor_missing(self) -> None:
        survey_answers = {
            "activities": [
                {"category": "unknown_category", "value": 100, "unit": "km"},
            ]
        }

        with self.assertRaises(CalculationEngineError):
            calculate_emissions(
                self.db,
                survey_answers=survey_answers,
                survey_region="IN",
                as_of=date(2025, 1, 1),
            )

    def test_calculate_emissions_prefers_custom_excel_override(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            workbook_path = Path(temp_dir) / "emission_factors.xlsx"
            workbook = Workbook()
            worksheet = workbook.active
            worksheet.append(
                [
                    "activity_name",
                    "category",
                    "region",
                    "unit_activity",
                    "default_factor_kgco2e_per_unit",
                    "default_source_name",
                    "default_source_url",
                    "default_source_year",
                    "custom_factor_kgco2e_per_unit",
                    "custom_source_name",
                    "custom_source_url",
                    "custom_source_year",
                ]
            )
            worksheet.append(
                [
                    "Petrol Car",
                    "petrol_car_km",
                    "IN",
                    "km",
                    "0.21",
                    "Default source",
                    "https://example.org/default",
                    "2024",
                    "0.5",
                    "Custom source",
                    "https://example.org/custom",
                    "2026",
                ]
            )
            workbook.save(workbook_path)
            workbook.close()

            original_path = os.environ.get("EMISSION_FACTOR_SHEET_PATH")
            os.environ["EMISSION_FACTOR_SHEET_PATH"] = str(workbook_path)
            try:
                result = calculate_emissions(
                    self.db,
                    survey_answers={
                        "activities": [{"category": "petrol_car_km", "value": 100, "unit": "km"}]
                    },
                    survey_region="IN",
                    as_of=date(2025, 1, 1),
                )
            finally:
                if original_path is None:
                    os.environ.pop("EMISSION_FACTOR_SHEET_PATH", None)
                else:
                    os.environ["EMISSION_FACTOR_SHEET_PATH"] = original_path

        self.assertEqual(result["total_kgco2e"], Decimal("50.0000"))
        self.assertEqual(
            result["lines"][0]["formula_string"],
            "100 km × 0.5 kgCO2e/km = 50 kgCO2e",
        )


if __name__ == "__main__":
    unittest.main()
