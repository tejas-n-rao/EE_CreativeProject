#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This script currently targets macOS (Darwin)."
  exit 1
fi

if ! command -v /opt/homebrew/bin/brew >/dev/null 2>&1 && ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew is required. Install from https://brew.sh and re-run."
  exit 1
fi

BREW_BIN="$(command -v brew || echo /opt/homebrew/bin/brew)"
eval "$("$BREW_BIN" shellenv)"

echo "[1/5] Installing required software..."
"$BREW_BIN" install node python@3.12 docker docker-compose colima codespell

echo "[2/5] Ensuring Docker Compose plugin discovery..."
mkdir -p "$HOME/.docker/cli-plugins"
ln -sf /opt/homebrew/lib/docker/cli-plugins/docker-compose "$HOME/.docker/cli-plugins/docker-compose"

echo "[3/5] Starting Colima..."
if ! colima status >/dev/null 2>&1; then
  colima start
fi

echo "[4/5] Installing Node workspace dependencies..."
cd "$REPO_ROOT"
npm install

echo "[5/5] Creating API virtualenv and installing Python dependencies..."
/opt/homebrew/bin/python3.12 -m venv "$REPO_ROOT/apps/api/.venv"
source "$REPO_ROOT/apps/api/.venv/bin/activate"
pip install -r "$REPO_ROOT/apps/api/requirements.txt"

echo
echo "Setup complete."
echo "- Run services: docker compose up --build"
echo "- Seed DB: docker compose exec api python scripts/seed_data.py"
