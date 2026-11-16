#!/usr/bin/env bash
set -euo pipefail

ssh root@172.16.31.178 'bash -s' <<'REMOTE'
set -euo pipefail

echo "SERVICES:"
systemctl is-active cipavd-backend.service nginx

echo "PORTAS:"
ss -ltnp | grep -E ":3000|:80" || true

echo "BACKEND LOG (last 120):"
journalctl -u cipavd-backend.service -n 120 --no-pager

echo "BACKEND HEALTH:"
curl -s --max-time 5 -o /dev/null -w "HEALTH=%{http_code}\n" http://127.0.0.1:3000/health || true

echo "FRONT STATUS:"
systemctl restart nginx
stat -c "FRONT_INDEX=%n %y" /opt/gestao-projetos/frontend/dist/index.html

if command -v rg >/dev/null 2>&1; then
  rg -R -n --binary-files=text -m 20 "Civil" /opt/gestao-projetos/frontend/dist/assets || true
else
  grep -R -n -m 20 --binary-files=text "Civil" /opt/gestao-projetos/frontend/dist/assets || true
fi

echo "HTTP ROOT:"
curl -I -s --max-time 5 http://127.0.0.1/ | head -n 5
REMOTE
