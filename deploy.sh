#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

if [[ ! -f .env ]]; then
  printf '%s\n' 'Crie o .env a partir de .env.example e preencha as credenciais.' >&2
  exit 1
fi

compose=(docker compose -f docker-compose.prod.yml)
"${compose[@]}" config --quiet
case "${1:-}" in
  --prepare)
    "${compose[@]}" --parallel 1 build
    exit ;;
  --start)
    ;;
  "")
    "${compose[@]}" --parallel 1 build ;;
  *)
    printf '%s\n' 'Uso: bash deploy.sh [--prepare|--start]' >&2
    exit 2 ;;
esac

"${compose[@]}" up -d --no-build --wait --wait-timeout 120
"${compose[@]}" ps
