#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/api"
if [ ! -d node_modules ]; then
  npm install --ignore-scripts
fi
export PORT=3001
export NODE_ENV=development
export AAKASHIK_E2E=1
export DB_PATH="$ROOT/api/data/e2e.db"
export FRONTEND_URL="http://127.0.0.1:8080"
exec node server.js
