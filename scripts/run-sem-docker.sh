#!/usr/bin/env bash
# Roda o projeto SEM Docker: usa PostgreSQL instalado no Mac (Homebrew).
# Útil quando o Docker está com erro de I/O.
set -euo pipefail
cd "$(dirname "$0")/.."

# Node 20
if [[ -f "$HOME/.nvm/nvm.sh" ]]; then
  source "$HOME/.nvm/nvm.sh"
  nvm use 20 2>/dev/null || true
fi

echo "[1/6] Verificando PostgreSQL..."
if ! command -v psql &>/dev/null; then
  echo "PostgreSQL não encontrado. Instale com:"
  echo "  brew install postgresql@16"
  echo "  echo 'export PATH=\"/opt/homebrew/opt/postgresql@16/bin:\$PATH\"' >> ~/.zshrc"
  echo "  source ~/.zshrc"
  exit 1
fi

# Garantir que Postgres está rodando (Homebrew)
if brew services list 2>/dev/null | grep -q postgresql; then
  brew services start postgresql@16 2>/dev/null || brew services start postgresql 2>/dev/null || true
fi
sleep 2

echo "[2/6] Criando usuário e banco (smif/smif_gestao)..."
psql -d postgres -v ON_ERROR_STOP=1 -c "CREATE USER smif WITH PASSWORD 'smif' CREATEDB;" 2>/dev/null || true
psql -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE smif_gestao OWNER smif;" 2>/dev/null || true

echo "[3/6] Gerando Prisma Client..."
npm run prisma:generate

echo "[4/6] Aplicando migrations..."
npm run prisma:migrate

echo "[5/6] Rodando seed demo..."
npm run seed:demo

echo "[6/6] Iniciando backend + frontend..."
npm run dev
