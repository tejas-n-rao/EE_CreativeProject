# Carbon Calculator Monorepo

Monorepo for a carbon calculator with:

- `apps/api`: FastAPI + SQLAlchemy + Alembic
- `apps/web`: Next.js frontend
- `packages/shared`: shared TypeScript types + JSON schemas
- `data`: small placeholder seed datasets with citations metadata

## Requirements

- Docker + Docker Compose (recommended local run)
- Python 3.11+ (for local API development)
- Node.js 20+ and npm (for local web development)
- Git

For macOS users, this repository includes a bootstrap script:

```bash
./scripts/setup_macos.sh
```

It installs required software via Homebrew, configures Docker compose plugin discovery, starts Colima, and installs repo dependencies.

## Project Layout

- `apps/api`: API, ORM models, migrations, seed scripts, tests
- `apps/web`: frontend pages (`/methodology`, `/dashboard/[surveyId]`)
- `packages/shared`: reusable type/schema package
- `data`: placeholder factors, methodology, benchmarks, fact templates

## Tech Stack

- Frontend:
  - Next.js 14 (App Router)
  - React 18
  - TypeScript
  - CSS (custom theme + print styles)
- Backend:
  - FastAPI
  - SQLAlchemy ORM
  - Alembic migrations
  - Pydantic schemas
  - PostgreSQL (Docker) / SQLite (tests)
- Data and shared assets:
  - JSON seed files for emission factors, benchmarks, methodology versions, facts
  - Editable Excel override file for emission factors (`data/emission_factors.xlsx`)
  - Shared TypeScript types + JSON schemas in `packages/shared`
- Tooling:
  - npm workspaces
  - Pytest (API tests)
  - ESLint + Prettier
  - Docker Compose for local orchestration

## Quick Start (Docker)

1. Build and run all services:

   ```bash
   docker compose up --build
   ```

2. Seed placeholder database records:

   ```bash
   docker compose exec api python scripts/seed_data.py
   ```

3. Open:

- Web: http://localhost:3000
- API docs: http://localhost:8000/docs
- API health: http://localhost:8000/health

4. Stop services:

   ```bash
   docker compose down
   ```

## Fresh Machine Setup (macOS)

If this is a new machine, run:

```bash
git clone <your-repo-url>
cd <repo-folder>
./scripts/setup_macos.sh
```

If `python3` still points to an old system version, run commands with `/opt/homebrew/bin/python3.12` explicitly, or initialize Homebrew shell environment first:

```bash
eval "$(/opt/homebrew/bin/brew shellenv)"
```

## No-Docker Run (Copy-Paste)

Use these exact commands on your machine.

### Terminal 1: API

```bash
cd "/Users/tejasrao/Desktop/Master/Studies_at_Krea/Year 3/T9/EE/CreativeProject"
eval "$(/opt/homebrew/bin/brew shellenv)"

cd apps/api

if [ ! -d .venv ]; then
  /opt/homebrew/bin/python3.12 -m venv .venv
fi

source .venv/bin/activate
pip install -r requirements.txt

alembic upgrade head
python scripts/seed_data.py
uvicorn app.main:app --reload --port 8000
```

### Terminal 2: Web

```bash
cd "/Users/tejasrao/Desktop/Master/Studies_at_Krea/Year 3/T9/EE/CreativeProject"
eval "$(/opt/homebrew/bin/brew shellenv)"

npm install
export NEXT_PUBLIC_API_BASE_URL="http://localhost:8000"
npm --workspace apps/web run dev
```

## Troubleshooting

- `Failed to fetch` on survey submit:
  - Confirm API is running in Terminal 1 on `http://localhost:8000`.
  - In Terminal 2, set:

    ```bash
    export NEXT_PUBLIC_API_BASE_URL="http://localhost:8000"
    ```

- `Failed to load methodology (500)`:
  - Run these in `apps/api`:

    ```bash
    source .venv/bin/activate
    alembic upgrade head
    python scripts/seed_data.py
    ```

  - Refresh `http://localhost:3000/methodology`.

### Open in Browser

- Web app: `http://localhost:3000`
- Accessible survey: `http://localhost:3000/accessible-survey`
- Monthly survey: `http://localhost:3000/monthly-survey`
- API docs: `http://localhost:8000/docs`

### Quick Check Commands

```bash
curl http://localhost:8000/health
```

## Local Development (Without Docker)

### API

```bash
cd apps/api
/opt/homebrew/bin/python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
python scripts/seed_data.py
uvicorn app.main:app --reload --port 8000
```

### Web

```bash
npm install
npm --workspace apps/web run dev
```

## Dependency Download For New Contributors

After cloning the repo, download project dependencies with:

```bash
npm install
/opt/homebrew/bin/python3.12 -m venv apps/api/.venv
source apps/api/.venv/bin/activate
pip install -r apps/api/requirements.txt
```

## How To Use The App

1. Create a survey:

   ```bash
   curl -X POST http://localhost:8000/v1/surveys \
     -H 'Content-Type: application/json' \
     -d '{
       "country": "IN",
       "answers_json": {
         "activities": [
           {"category": "electricity", "value": 240, "unit": "kWh"},
           {"category": "petrol_car_km", "value": 180, "unit": "km"}
         ]
       }
     }'
   ```

2. Run calculation for that survey (`<survey-id>` from step 1):

   ```bash
   curl -X POST http://localhost:8000/v1/surveys/<survey-id>/calculate \
     -H 'Content-Type: application/json' \
     -d '{}'
   ```

3. Open dashboard:

- API dashboard payload: `GET /v1/surveys/<survey-id>/dashboard`
- Frontend dashboard page: `http://localhost:3000/dashboard/<survey-id>`

## Calculation Reference And Conventions

### Core GHG Equation

`Emissions (kgCO2e) = Activity Data × Emission Factor`

### Carbon Index Equations

- Annual footprint = monthly footprint × 12
- India Carbon Index = `(user_annual_emissions / india_per_capita_emissions) × 100`
- World Carbon Index = `(user_annual_emissions / world_per_capita_emissions) × 100`

### Conventions Used In This App

- Monthly footprint values are stored/returned in `kgCO2e`.
- Annual footprint for index comparison is derived from monthly values.
- Benchmarks are per-capita annual values in `tonnes CO2e/person`.
- Index calculations convert user annual emissions from kg to tonnes before comparison.
- Placeholder seed datasets are intentionally small and include `citations` metadata.
- Accessible survey converts weekly lifestyle travel into monthly activity using `weekly × 4.345`.
- Accessible survey converts annual flights to monthly activity using `annual ÷ 12`.
- Accessible survey replaces abstract low/medium/high profiles with concrete prompts (household size, AC hours/day, showers/week, laundry loads/week, and home-cooked meals/week).
- Monthly survey supports expanded transport and livelihood categories (bus, metro, rail, two-wheeler, LPG, diet profiles).
- Dashboard includes class-level annual benchmark comparison for transportation, food, and water consumption (User vs India vs World).

### Detailed Calculation Methodology (With Sources)

1. Input normalization
   - Monthly survey (`/monthly-survey`) sends activity values directly as monthly units.
   - Weekly survey (`/accessible-survey`) converts user inputs into monthly activity:
     - `monthly_commute_km = commute_days_per_week × round_trip_km × 4.345`
     - `monthly_extra_mode_km = weekly_mode_km × 4.345`
     - `monthly_flight_passenger_km = (flights_per_year × avg_flight_distance_km) ÷ 12`
     - `electricity_kwh_monthly = 45 + household_size × 18 + ac_hours_per_day × 30 × 1.2 + (25 if refrigerator)`
     - `weekly_water_liters = household_size × 40 × 7 + showers_per_week × 50 + laundry_loads_per_week × 70`
     - `water_m3_monthly = (weekly_water_liters × 4.345) ÷ 1000`
     - `lpg_kg_monthly = home_cooked_meals_per_week × 0.08 × 4.345`
     - Diet category adds `30 person_day` monthly.
   - Weekly form rounds per-category derived monthly activity to 2 decimals before API submission.
   - Source implementation:
     - `apps/web/app/accessible-survey/AccessibleSurveyForm.tsx`
     - `apps/web/app/survey/SurveyForm.tsx`

2. Emission factor lookup
   - API first checks `data/emission_factors.xlsx` for a custom override row.
   - If no custom override exists, API matches each activity by `(category, unit_activity, region, valid date)` in DB.
   - If no region-specific factor exists, API falls back to `WORLD`.
   - Source implementation:
     - `apps/api/app/services/calculation_engine.py`
     - `apps/api/app/services/emission_factor_sheet.py`
   - Seeded factor dataset:
     - `data/db_emission_factors.json` (source-backed factors synced from sheet)
   - Editable override sheet:
     - `data/emission_factors.xlsx` (custom factor/source columns)

3. Emissions per category and total
   - Per-category monthly emissions:
     - `line_kgco2e = activity_value × factor_kgco2e_per_unit`
   - Rounding:
     - each line is rounded to 4 decimals (`0.0001`)
     - monthly total is the sum of rounded lines, then rounded to 4 decimals
   - Source implementation:
     - `apps/api/app/services/calculation_engine.py`

4. Carbon index calculation
   - `annual_kgco2e = monthly_kgco2e × 12`
   - `annual_tonnes = annual_kgco2e ÷ 1000`
   - `india_index = (annual_tonnes ÷ india_per_capita_tonnes) × 100`
   - `world_index = (annual_tonnes ÷ world_per_capita_tonnes) × 100`
   - Index values are rounded to 2 decimals.
   - Source implementation:
     - `apps/api/app/services/carbon_index.py`
   - Benchmark seed dataset:
     - `data/db_benchmark_stats.json`

5. Rendered facts (dashboard insights)
   - Text templates are rendered by replacing placeholders:
     - `{{value}}` with monthly total
     - `{{percent}}` with `(world_index - 100)`
   - Source implementation:
     - `apps/api/app/services/facts.py`
   - Template seed dataset:
     - `data/fact_templates.json`

### Activity Emission Factor Reference (Current + Overrides)

The calculator reads defaults and optional custom overrides from `data/emission_factors.xlsx`.
Edit these columns per row to override calculations and methodology sources live:

- `custom_factor_kgco2e_per_unit`
- `custom_source_name`
- `custom_source_url`
- `custom_source_year`

Leave custom columns blank to use the standard seeded values.

| Activity | Category key | Unit | Factor (kgCO2e/unit) | Region | Source |
| --- | --- | --- | ---: | --- | --- |
| Electricity | `electricity` | `kWh` | 0.757 | IN | CEA |
| Water Supply | `water_supply_m3` | `m3` | 0.344 | WORLD | UK Environment Agency |
| Petrol Car | `petrol_car_km` | `km` | 0.171 | WORLD | Our World in Data, India GHGP |
| Diesel Car | `diesel_car_km` | `km` | 0.171 | WORLD | Our World in Data |
| Bus | `bus_km` | `km` | 0.097 | WORLD | Our World in Data |
| Metro | `metro_km` | `km` | 0.041 | WORLD | Custom |
| Rail | `rail_km` | `km` | 0.035 | IN | India GHGP |
| Two-wheeler | `two_wheeler_km` | `km` | 0.035 | IN | India GHGP |
| Short-haul flight | `flight_shorthaul` | `passenger_km` | 0.121 | IN | India GHGP |
| Cooking Gas (LPG) | `lpg_kg` | `kg` | 2.990 | IN | Custom |
| Diet (Plant-based) | `diet_plant_based_day` | `person_day` | 1.800 | WORLD | Custom |
| Diet (Mixed) | `diet_mixed_day` | `person_day` | 2.750 | WORLD | Custom |
| Diet (Meat-heavy) | `diet_meat_heavy_day` | `person_day` | 4.850 | WORLD | Custom |

Source links are stored per-row in `data/emission_factors.xlsx` and synced into `data/db_emission_factors.json`.

### Benchmark Sources (Verified 2026-03-06)

- Total annual per-capita GHG benchmark:
  - OWID per-capita GHG (including land use): `https://ourworldindata.org/grapher/per-capita-ghg-emissions.csv`
- Transportation class benchmark:
  - OWID transport CO2 per capita: `https://ourworldindata.org/grapher/per-capita-co2-transport.csv`
- Food class benchmark:
  - OWID food emissions totals: `https://ourworldindata.org/grapher/emissions-from-food.csv`
  - World Bank population (for per-capita derivation): `https://api.worldbank.org/v2/country/IND;WLD/indicator/SP.POP.TOTL?format=json&per_page=400`
- Water class benchmark:
  - World Bank total freshwater withdrawals: `https://api.worldbank.org/v2/country/IND;WLD/indicator/ER.H2O.FWTL.K3?format=json&per_page=400`
  - World Bank domestic withdrawal share: `https://api.worldbank.org/v2/country/IND;WLD/indicator/ER.H2O.FWDM.ZS?format=json&per_page=400`
  - World Bank population (for per-capita derivation): `https://api.worldbank.org/v2/country/IND;WLD/indicator/SP.POP.TOTL?format=json&per_page=400`

## Main API Endpoints

- `POST /v1/surveys`
- `POST /v1/surveys/{id}/calculate`
- `GET /v1/surveys/{id}/dashboard`
- `GET /v1/benchmarks`
- `GET /v1/methodology`
- `GET /v1/emission-factors/current`
- `GET /v1/facts`

## Shared Types And Schemas

- TS types: `packages/shared/src/types.ts`
- JSON schemas:
  - `packages/shared/schemas/emission-factor.schema.json`
  - `packages/shared/schemas/benchmark-stat.schema.json`
  - `packages/shared/schemas/fact-template.schema.json`

## Seed Data

- `data/emission_factors.json`
- `data/benchmark_stats.json`
- `data/fact_templates.json`
- `data/db_emission_factors.json`
- `data/db_methodology_versions.json`
- `data/db_benchmark_stats.json`
- `data/emission_factors.xlsx`

All seed datasets are placeholders (non-proprietary) and should be replaced with validated public data before production use.

## Formatting, Linting, Hooks

- Python (Ruff config): `pyproject.toml`
- Web linting (ESLint): `apps/web/.eslintrc.json`
- Formatting (Prettier): `.prettierrc`
- Optional pre-commit:

```bash
pip install pre-commit
pre-commit install
pre-commit run --all-files
```
