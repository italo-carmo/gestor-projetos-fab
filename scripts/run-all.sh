#!/usr/bin/env bash
set -euo pipefail

MODE="dev"

if [[ "${1:-}" == "--prod" ]]; then
  MODE="prod"
fi

node_version_raw=$(node -v 2>/dev/null || true)
if [[ -z "$node_version_raw" ]]; then
  echo "Node.js nao encontrado. Instale Node 20.19+ antes de rodar."
  exit 1
fi

node_version=${node_version_raw#v}
major=$(echo "$node_version" | cut -d. -f1)
minor=$(echo "$node_version" | cut -d. -f2)
patch=$(echo "$node_version" | cut -d. -f3)

if [[ "$major" -lt 20 ]] || [[ "$major" -eq 20 && ( "$minor" -lt 19 ) ]]; then
  echo "Node.js $node_version_raw encontrado, mas o minimo e 20.19+."
  exit 1
fi

if [[ "$MODE" == "prod" ]]; then
  echo "[prod] Subindo stack via docker compose..."
  docker compose -f docker-compose.prod.yml up -d
  echo "[prod] Rodando seed demo (opcional)..."
  npm run seed:demo
  echo "[prod] OK."
  exit 0
fi

echo "[dev] Instalando dependencias..."
npm install --workspaces


echo "[dev] Migrando + seed demo..."
npm run prisma:migrate
npm run seed:demo

echo "[dev] Subindo backend + frontend..."
npm run dev
