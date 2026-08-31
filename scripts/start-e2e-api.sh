#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/api"
if [ ! -d node_modules ]; then
  npm install
fi
export PORT=3001
export NODE_ENV=development
exec node server.js
