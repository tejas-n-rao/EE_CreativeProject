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
- Survey form: `http://localhost:3000/survey`
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

## Main API Endpoints

- `POST /v1/surveys`
- `POST /v1/surveys/{id}/calculate`
- `GET /v1/surveys/{id}/dashboard`
- `GET /v1/benchmarks`
- `GET /v1/methodology`
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
