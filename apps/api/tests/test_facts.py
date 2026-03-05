from __future__ import annotations

import sys
import unittest
from decimal import Decimal
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

from app.services.facts import render_fact_templates  # noqa: E402


class FactsServiceTestCase(unittest.TestCase):
    def test_render_fact_templates_substitutes_placeholders(self) -> None:
        templates = [
            {
                "id": "fact-1",
                "template": "Electricity usage contributed {{value}} kgCO2e.",
                "tags": ["electricity"],
                "citations": [],
            },
            {
                "id": "fact-2",
                "template": "Transport emissions are {{percent}}% above benchmark.",
                "tags": ["transport"],
                "citations": [],
            },
        ]

        result = render_fact_templates(
            templates,
            total_kgco2e=Decimal("42.5000"),
            world_index=Decimal("112.30"),
        )

        self.assertEqual(
            result[0]["rendered_text"],
            "Electricity usage contributed 42.5 kgCO2e.",
        )
        self.assertEqual(
            result[1]["rendered_text"],
            "Transport emissions are 12.3% above benchmark.",
        )


if __name__ == "__main__":
    unittest.main()
