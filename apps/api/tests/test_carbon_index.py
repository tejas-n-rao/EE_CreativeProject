from __future__ import annotations

import unittest
from decimal import Decimal
from pathlib import Path
import sys

API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

from app.services.carbon_index import (  # noqa: E402
    annual_footprint,
    calculate_carbon_index,
    interpret_index,
)


class CarbonIndexTestCase(unittest.TestCase):
    def test_annual_footprint_multiplies_monthly_by_twelve(self) -> None:
        self.assertEqual(annual_footprint(Decimal("100")), Decimal("1200.0000"))
        self.assertEqual(annual_footprint(Decimal("42.5")), Decimal("510.0000"))

    def test_interpret_index_boundaries(self) -> None:
        self.assertEqual(interpret_index(Decimal("69.99")), "below average")
        self.assertEqual(interpret_index(Decimal("70")), "around average")
        self.assertEqual(interpret_index(Decimal("130")), "around average")
        self.assertEqual(interpret_index(Decimal("130.01")), "above average")

    def test_calculate_carbon_index_uses_annualized_formula(self) -> None:
        # monthly 350 kg => annual 4200 kg => 4.2 tonnes
        result = calculate_carbon_index(
            monthly_footprint_kgco2e=Decimal("350"),
            india_per_capita_emissions_tonnes=Decimal("2.1"),
            world_per_capita_emissions_tonnes=Decimal("4.7"),
        )

        self.assertEqual(result["india_index"], Decimal("200.00"))
        self.assertEqual(result["world_index"], Decimal("89.36"))
        self.assertEqual(result["interpretation"], "around average")


if __name__ == "__main__":
    unittest.main()
