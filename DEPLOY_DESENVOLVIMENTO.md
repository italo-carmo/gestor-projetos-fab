# Deploy em Desenvolvimento (Sem Docker)

Fluxo oficial para publicar no servidor de desenvolvimento `172.16.31.177`.

**Regra fixa de ambientes:**
- Desenvolvimento: `172.16.31.177`
- Producao: `172.16.31.178`

Antes de executar qualquer comando, confirme que a solicitacao e de **desenvolvimento**. Se a solicitacao for de producao, use [`DEPLOY_PRODUCAO.md`](./DEPLOY_PRODUCAO.md).

## Topologia de desenvolvimento
- Host: `172.16.31.177`
- Usuario: `root`
- Codigo fonte com git: `/home/sddm/gestor-projetos-fab`
- Runtime servido pelo Nginx/Systemd: `/opt/gestao-projetos`
- Backend service: `cipavd-backend.service`
- Frontend: Nginx com `root /opt/gestao-projetos/frontend/dist`

## Checklist rapido antes de deploy
1. Confirmar que o deploy solicitado e para **desenvolvimento**.
2. Confirmar commit esperado em `origin/main`.
3. Garantir acesso SSH ao servidor `172.16.31.177` com usuario `root`.
4. Fazer deploy sempre para `/opt/gestao-projetos` (nao apenas em `/home/sddm/...`).
5. Nao usar `172.16.31.178` neste fluxo.

## Deploy completo (passo a passo)

### 1) Atualizar codigo fonte (repo git)
```bash
ssh root@172.16.31.177
cd /home/sddm/gestor-projetos-fab
git checkout main
git pull --ff-only origin main
git rev-parse --short HEAD
```

### 2) Sincronizar codigo para runtime
Preservar pastas de upload e o `.env` de desenvolvimento.

```bash
rsync -a --delete \
  --exclude ".git" \
  --exclude "node_modules" \
  --exclude "frontend/node_modules" \
  --exclude "backend/node_modules" \
  --exclude "backend/.env" \
  -f 'P backend/uploads' -f 'P uploads' -f 'P backend/.env' \
  /home/sddm/gestor-projetos-fab/ /opt/gestao-projetos/
```

### 3) Instalar dependencias, migrar banco e build backend
```bash
cd /opt/gestao-projetos
npm install --workspaces --no-audit --no-fund

cd backend
npx prisma migrate deploy
npx prisma generate
rm -rf dist
npm run build
```

### 4) Build frontend
```bash
cd /opt/gestao-projetos/frontend
npm install --no-audit --no-fund
rm -rf dist
npx vite build
```

### 5) Reiniciar servicos
```bash
systemctl stop cipavd-backend.service || true
sleep 2
fuser -k 3000/tcp 2>/dev/null || true
sleep 1
systemctl start cipavd-backend.service
systemctl restart nginx
systemctl is-active cipavd-backend.service nginx
```

### 6) Validacao pos-deploy
```bash
curl -s -o /dev/null -w "HEALTH=%{http_code}\n" http://127.0.0.1:3000/health
curl -s -o /dev/null -w "ROOT=%{http_code}\n" http://127.0.0.1/
sed -n '1,40p' /opt/gestao-projetos/frontend/dist/index.html
```

## Comando unico (desenvolvimento)
```bash
ssh root@172.16.31.177 'bash -s' <<'REMOTE'
set -e
cd /home/sddm/gestor-projetos-fab
git checkout main
git pull --ff-only origin main
echo "SOURCE_HEAD=$(git rev-parse --short HEAD)"

rsync -a --delete --exclude ".git" --exclude "node_modules" --exclude "frontend/node_modules" --exclude "backend/node_modules" --exclude "backend/.env" -f 'P backend/uploads' -f 'P uploads' -f 'P backend/.env' \
  /home/sddm/gestor-projetos-fab/ /opt/gestao-projetos/

cd /opt/gestao-projetos
npm install --workspaces --no-audit --no-fund
cd backend
npx prisma migrate deploy
npx prisma generate
rm -rf dist
npm run build
cd ../frontend
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
sleep 3
curl -s -o /dev/null -w "HEALTH=%{http_code}\n" http://127.0.0.1:3000/health
curl -s -o /dev/null -w "ROOT=%{http_code}\n" http://127.0.0.1/
stat -c "FRONT index.html %y" /opt/gestao-projetos/frontend/dist/index.html
REMOTE
```
