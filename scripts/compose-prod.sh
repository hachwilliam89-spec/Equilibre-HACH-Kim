#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
args=(--env-file .env.prod)
if [[ -s .env.release ]]; then args+=(--env-file .env.release); fi
exec docker compose --project-name equilibre-prod "${args[@]}" -f docker-compose.yml -f docker-compose.prod.yml "$@"
