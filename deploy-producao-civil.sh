#!/usr/bin/env bash
set -euo pipefail
set -x

HOST="172.16.31.178"
SOURCE_DIR="/home/sddm/gestor-projetos-fab"
TARGET_DIR="/opt/gestao-projetos"

ssh "root@${HOST}" 'bash -s' <<'REMOTE'
set -euo pipefail
set -x

SOURCE_DIR="/home/sddm/gestor-projetos-fab"
TARGET_DIR="/opt/gestao-projetos"

cd "$SOURCE_DIR"
git fetch --all
git checkout main
git reset --hard origin/main
echo "SOURCE_HEAD=$(git rev-parse --short HEAD)"
git log --oneline -1 --decorate

rsync -a --delete \
  --exclude ".git" \
  --exclude "node_modules" \
  --exclude "frontend/node_modules" \
  --exclude "backend/node_modules" \
  --exclude "backend/.env" \
  -f 'P backend/uploads' -f 'P uploads' -f 'P backend/.env' \
  /home/sddm/gestor-projetos-fab/ /opt/gestao-projetos/

cd "$TARGET_DIR"
npm install --workspaces --no-audit --no-fund

cd backend
npx prisma migrate deploy
npx prisma generate
rm -rf dist
npm run build

cd "$TARGET_DIR/frontend"
npm install --no-audit --no-fund
rm -rf dist
npx vite build

systemctl stop cipavd-backend.service || true
sleep 2
fuser -k 3000/tcp 2>/dev/null || true
sleep 1
systemctl start cipavd-backend.service
systemctl restart nginx
systemctl is-active cipavd-backend.service nginx

stat -c "FRONT_INDEX=%n %y" /opt/gestao-projetos/frontend/dist/index.html
rg -n "Civil" /opt/gestao-projetos/frontend/dist/assets | head -n 20 || true

curl -s -o /dev/null -w "HEALTH=%{http_code}\n" http://127.0.0.1:3000/health
curl -s -o /dev/null -w "ROOT=%{http_code}\n" http://127.0.0.1/

echo "DEPLOY_PRODUCTION_COMPLETED"
REMOTE
