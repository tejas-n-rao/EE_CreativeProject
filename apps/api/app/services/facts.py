from __future__ import annotations

import json
from decimal import Decimal
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[4]
FACT_TEMPLATES_PATH = ROOT_DIR / "data" / "fact_templates.json"


class FactsError(ValueError):
    pass


def _format_value(value: object) -> str:
    if value is None:
        return "0"
    if isinstance(value, Decimal):
        text = format(value.normalize(), "f")
    elif isinstance(value, float):
        text = f"{value:.2f}"
    else:
        text = str(value)

    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text or "0"


def load_fact_templates() -> list[dict]:
    if not FACT_TEMPLATES_PATH.exists():
        raise FactsError(f"Fact templates file not found: {FACT_TEMPLATES_PATH}")

    with FACT_TEMPLATES_PATH.open("r", encoding="utf-8") as file:
        payload = json.load(file)

    if not isinstance(payload, list):
        raise FactsError("Fact templates file must contain a JSON array")

    return payload


def render_fact_templates(
    templates: list[dict],
    *,
    total_kgco2e: Decimal | float | int | None,
    world_index: Decimal | float | int | None,
) -> list[dict]:
    percent_delta = Decimal("0")
    if world_index is not None:
        percent_delta = Decimal(str(world_index)) - Decimal("100")

    rendered: list[dict] = []
    for item in templates:
        if not isinstance(item, dict):
            continue

        template = str(item.get("template", ""))
        text = template.replace("{{value}}", _format_value(total_kgco2e)).replace(
            "{{percent}}", _format_value(percent_delta)
        )

        rendered.append(
            {
                "id": str(item.get("id", "")),
                "template": template,
                "rendered_text": text,
                "tags": item.get("tags", []),
                "citations": item.get("citations", []),
            }
        )

    return rendered
