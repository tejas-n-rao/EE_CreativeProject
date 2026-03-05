# Carbon Calculator Monorepo

Monorepo scaffold for a carbon calculator with:

- `apps/api`: FastAPI backend
- `apps/web`: Next.js frontend
- `packages/shared`: shared TypeScript types + JSON schemas
- `data`: small placeholder seed datasets with citations metadata

API now includes a greenhouse-gas accounting schema with SQLAlchemy models and Alembic migrations.

## Prerequisites

- Docker + Docker Compose
- Node.js 20+ (for local non-Docker web development)
- Python 3.11+ (for local non-Docker API development)

## Local Setup (Docker)

1. Build and start all services:

   ```bash
   docker compose up --build
   ```

2. Open apps:

- Web: http://localhost:3000
- API docs: http://localhost:8000/docs
- API health: http://localhost:8000/health

3. Seed placeholder DB data:

   ```bash
   docker compose exec api python scripts/seed_data.py
   ```

4. Stop services:

   ```bash
   docker compose down
   ```

## Local Setup (Without Docker)

### API

```bash
cd apps/api
python -m venv .venv
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

## Shared Types and Schemas

- TS types: `packages/shared/src/types.ts`
- JSON schemas:
  - `packages/shared/schemas/emission-factor.schema.json`
  - `packages/shared/schemas/benchmark-stat.schema.json`
  - `packages/shared/schemas/fact-template.schema.json`

## Seed Data

Seed files are placeholders and intentionally small:

- `data/emission_factors.json`
- `data/benchmark_stats.json`
- `data/fact_templates.json`
- `data/db_emission_factors.json`
- `data/db_methodology_versions.json`
- `data/db_benchmark_stats.json`

Each record includes a `citations` field for source traceability. Replace placeholders with validated public datasets before production usage.

## Formatting and Linting

- Python (Ruff config): `pyproject.toml`
- Web linting (ESLint): `apps/web/.eslintrc.json`
- Formatting (Prettier): `.prettierrc`

## Optional: Pre-commit Hooks

```bash
pip install pre-commit
pre-commit install
pre-commit run --all-files
```
