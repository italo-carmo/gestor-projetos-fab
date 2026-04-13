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
Preservar pastas de upload (fotos do mapeamento institucional): `-f 'P backend/uploads'` e `-f 'P uploads'`.

**Importante:** com `--delete`, o `rsync` pode **apagar** `/opt/gestao-projetos/backend/.env` se ele nao existir no clone (segredos nao vao pro Git). Use **protecao** e **nao copie** `.env` do clone:
- `-f 'P backend/.env'` — nao remove o `.env` de producao
- `--exclude 'backend/.env'` — nao sobrescreve com um `.env` eventual no servidor de build

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
Se suspeitar de `dist` antigo ou incremental estranho, apague antes: `rm -rf /opt/gestao-projetos/backend/dist`.
```bash
cd /opt/gestao-projetos
npm install --workspaces --no-audit --no-fund

cd backend
npx prisma migrate deploy
npx prisma generate
npm run build
```

### 4) Build frontend (producao)
Idem: `rm -rf /opt/gestao-projetos/frontend/dist` antes do build se o bundle parecer desatualizado.
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
# Reinicio limpo (evita EADDRINUSE se sobrar node na 3000)
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
'
```

## Troubleshooting
- Se o app nao refletir mudanca, confira se `index.html` em `/opt/gestao-projetos/frontend/dist` aponta para bundle novo.
- Se health retornar `000` logo apos restart, aguarde 2-5s e teste novamente.
- Se migration falhar, nao reinicie servicos antes de corrigir o banco.
- **Fotos do mapeamento institucional (NOT_FOUND)**: antigamente o rsync com `--delete` apagava a pasta de uploads a cada deploy. A partir deste fluxo, `backend/uploads` e `uploads` sao preservados. Fotos enviadas antes disso foram perdidas — e preciso reenviar. Opcional: definir `MISSION_CHECKLIST_UPLOADS_DIR` (ex: `/var/lib/cipavd/mission-checklist-uploads`) no systemd e criar o diretório para que as fotos fiquem fora da árvore do app.
- **LiteLLM “nao configurado” apos deploy**: o `rsync --delete` podia **remover** `backend/.env` em `/opt/gestao-projetos` se o arquivo nao existisse no clone. O fluxo acima protege o `.env`. Se sumiu, recrie `/opt/gestao-projetos/backend/.env` (ou `scp` da maquina local) com `API_LITELLM` e `API_LITELLM_BASE_URL` e reinicie o backend.
- **Frontend ou backend “antigo” apos deploy**: no servidor, apagar `backend/dist` e `frontend/dist`, rodar `npm run build` / `vite build` de novo, reiniciar `cipavd-backend`. No navegador use atualizacao forcada (Ctrl+F5) ou janela anonima; o Nginx em producao pode usar `Cache-Control: no-store` em `/index.html` e cache longo em `/assets/` para o hash do Vite sempre mandar no JS certo.
- **Sintoma: backend novo e frontend de meses atras**: o `index.html` em `/opt/gestao-projetos/frontend/dist` fica com data antiga — o passo `npx vite build` **em /opt/gestao-projetos/frontend** nao foi executado (ou falhou). Confira `stat /opt/gestao-projetos/frontend/dist/index.html` apos cada deploy; o comando unico abaixo ja inclui `rm -rf dist` nos dois lados antes do build.
