# Deploy em Producao (Sem Docker)

Fluxo oficial para publicar no servidor `172.16.31.178`, evitando divergencia entre pasta de codigo e pasta realmente servida.

## Topologia real de producao
- Host: `172.16.31.178`
- Usuario: `root`
- Codigo fonte com git: `/home/sddm/gestor-projetos-fab`
- Runtime servido pelo Nginx/Systemd: `/opt/gestao-projetos`
- Backend service: `cipavd-backend.service`
- Frontend: Nginx com `root /opt/gestao-projetos/frontend/dist`

## Checklist rapido antes de deploy
1. Confirmar commit esperado em `origin/main`.
2. Garantir acesso SSH ao servidor com usuario `root`.
3. Fazer deploy sempre para `/opt/gestao-projetos` (nao apenas em `/home/sddm/...`).

## Deploy completo (passo a passo)

### 1) Atualizar codigo fonte (repo git)
```bash
ssh root@172.16.31.178
cd /home/sddm/gestor-projetos-fab
git checkout main
git pull --ff-only origin main
git rev-parse --short HEAD
```

### 2) Sincronizar codigo para runtime
```bash
rsync -a --delete \
  --exclude ".git" \
  --exclude "node_modules" \
  --exclude "frontend/node_modules" \
  --exclude "backend/node_modules" \
  /home/sddm/gestor-projetos-fab/ /opt/gestao-projetos/
```

### 3) Instalar dependencias, migrar banco e build backend
```bash
cd /opt/gestao-projetos
npm install --workspaces --no-audit --no-fund

cd backend
npx prisma migrate deploy
npm run build
```

### 4) Build frontend (producao)
```bash
cd /opt/gestao-projetos/frontend
npm install --no-audit --no-fund
npx vite build
```

Observacao: atualmente o frontend possui erros legados de tipagem para `tsc -b`. Para publicacao, usar `npx vite build` ate saneamento completo do typecheck.

### 5) Reiniciar servicos
```bash
systemctl restart cipavd-backend.service
systemctl restart nginx
systemctl is-active cipavd-backend.service nginx
```

### 6) Validacao pos-deploy
```bash
curl -i http://127.0.0.1:3000/health
curl -I http://127.0.0.1/
```

Validar hash do bundle publicado:
```bash
sed -n '1,40p' /opt/gestao-projetos/frontend/dist/index.html
```

Validar rota da API no frontend:
```bash
grep -R "localhost:3000" -n /opt/gestao-projetos/frontend/dist || true
```

Esperado: sem referencia fixa de API local para producao.

## Comando unico (copiar e colar)
```bash
ssh root@172.16.31.178 '
set -e
cd /home/sddm/gestor-projetos-fab
git checkout main
git pull --ff-only origin main
echo "SOURCE_HEAD=$(git rev-parse --short HEAD)"

rsync -a --delete --exclude ".git" --exclude "node_modules" --exclude "frontend/node_modules" --exclude "backend/node_modules" \
  /home/sddm/gestor-projetos-fab/ /opt/gestao-projetos/

cd /opt/gestao-projetos
npm install --workspaces --no-audit --no-fund
cd backend
npx prisma migrate deploy
npm run build
cd ../frontend
npm install --no-audit --no-fund
npx vite build
systemctl restart cipavd-backend.service
systemctl restart nginx
systemctl is-active cipavd-backend.service nginx
sleep 2
curl -s -o /dev/null -w "HEALTH=%{http_code}\n" http://127.0.0.1:3000/health
curl -s -o /dev/null -w "ROOT=%{http_code}\n" http://127.0.0.1/
'
```

## Troubleshooting
- Se o app nao refletir mudanca, confira se `index.html` em `/opt/gestao-projetos/frontend/dist` aponta para bundle novo.
- Se health retornar `000` logo apos restart, aguarde 2-5s e teste novamente.
- Se migration falhar, nao reinicie servicos antes de corrigir o banco.
