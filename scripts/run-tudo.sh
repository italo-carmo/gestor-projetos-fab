#!/usr/bin/env bash
# Roda tudo: Docker, migrations, seed e app (Node 20)
set -euo pipefail
cd "$(dirname "$0")/.."

# Usar Node 20 se nvm disponível
if [[ -f "$HOME/.nvm/nvm.sh" ]]; then
  source "$HOME/.nvm/nvm.sh"
  nvm use 20 2>/dev/null || true
fi

echo "[1/5] Subindo Docker (Postgres + MinIO)..."
docker compose up -d

echo "[2/5] Gerando Prisma Client..."
npm run prisma:generate

echo "[3/5] Aplicando migrations..."
npm run prisma:migrate

echo "[4/5] Rodando seed demo..."
npm run seed:demo

echo "[5/5] Iniciando backend + frontend..."
npm run dev
