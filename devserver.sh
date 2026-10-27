#!/bin/bash
# Lancer le dev server SoryOS-Code pour Firebase Studio preview
# IDX injecte $PORT automatiquement, sinon fallback sur 3000

PORT="${PORT:-3000}"

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR/apps/web"
exec npm run dev -- -p "$PORT" -H 0.0.0.0

