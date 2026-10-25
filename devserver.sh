#!/bin/bash
# Lancer le dev server SoryOS-Code pour Firebase Studio preview
# IDX injecte $PORT automatiquement, sinon fallback sur 3000

PORT="${PORT:-3000}"

echo "Starting SoryOS-Code dev server on port $PORT..."
cd /home/user/studio/apps/web
exec npm run dev -- --port "$PORT" --hostname 0.0.0.0
