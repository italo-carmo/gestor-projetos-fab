# CIPAVD Gestao - Monorepo

## Requisitos
- Node.js `^20.19` ou `^22.12` (Prisma 7 não suporta Node 18)
- Docker + Docker Compose (ou PostgreSQL local para rodar sem Docker)

## Rodar sem Docker (PostgreSQL no Mac)
Se o Docker estiver com erro de I/O ou não quiser usar Docker:

1. Instale o PostgreSQL 16: `brew install postgresql@16`
2. Adicione ao PATH: `echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc` e `source ~/.zshrc`
3. Rode o script: `bash scripts/run-sem-docker.sh`

O script cria o usuário `smif` e o banco `smif_gestao` e sobe backend + frontend. MinIO não é obrigatório para desenvolvimento básico.

## Setup rapido (com Docker)

1) Subir infraestrutura (1 comando)

```bash
docker compose up -d
```

2) Instalar dependencias

```bash
npm run install:all
```

3) Gerar Prisma Client e rodar migrations

```bash
npm run prisma:generate
npm run prisma:migrate
```

4) Rodar seed demo

```bash
npm run seed:demo
```

5) Iniciar stack (backend + frontend)

```bash
npm run dev
```

## Variaveis de ambiente (backend)
Copie `backend/.env.example` para `backend/.env` e ajuste se necessario.

## Variaveis de ambiente (frontend)
Crie `frontend/.env` com:
```
VITE_API_BASE_URL=http://localhost:3000
```

## Credenciais demo
- `ti@smif.local` / `Admin123`
- `cipavd@smif.local` / `Admin123`
- `comgep@smif.local` / `Admin123`
- `gsd.bsb@smif.local` / `Admin123`

## Credenciais após importação real (`npm run seed:repositorio`)
- `admin@smif.local` / `Smif@2026`
- `ti@smif.local` / `Smif@2026`

## Endpoints iniciais
- POST `/auth/login`
- POST `/auth/refresh`
- GET `/auth/me`

## Servicos
- Postgres: `localhost:5432`
- MinIO: `localhost:9000` (console em `localhost:9001`)

## Checklist (RBAC + Core)
1) Subir stack:
```bash
docker compose up -d
```

2) Instalar deps:
```bash
npm run install:all
```

3) Gerar Prisma Client:
```bash
npm run prisma:generate
```

4) Aplicar migrations:
```bash
npm run prisma:migrate
```

5) Rodar seed demo:
```bash
npm run seed:demo
```

6) Testar endpoints principais:
- `POST /auth/login`
- `GET /roles`
- `GET /permissions`
- `GET /phases`
- `GET /task-instances`
- `GET /dashboard/national`

## E2E (Playwright)
Pré-requisito: backend e frontend rodando + seed demo aplicado.
```bash
npm run e2e
```

## Gerar client TS
```bash
node scripts/generate-client.ts full
```

## Deploy (ambientes oficiais)
Regra fixa de ambientes:
- **Desenvolvimento:** `172.16.31.177`
- **Produção:** `172.16.31.178`

Antes de qualquer deploy, confirme explicitamente o ambiente solicitado. Nunca use o servidor de produção (`172.16.31.178`) para um deploy de desenvolvimento.

Os servidores atuais não usam o fluxo Docker deste repositório.

Use o tutorial oficial:
- [`DEPLOY_DESENVOLVIMENTO.md`](./DEPLOY_DESENVOLVIMENTO.md)
- [`DEPLOY_PRODUCAO.md`](./DEPLOY_PRODUCAO.md)

Resumo do fluxo sem Docker:
1) atualizar `/home/sddm/gestor-projetos-fab` via `git pull`
2) sincronizar para `/opt/gestao-projetos`
3) build backend/frontend em `/opt/gestao-projetos`
4) reiniciar `cipavd-backend.service` e `nginx`
5) validar `/health` e `index.html` publicado

## Backup/Restore (Postgres)
Backup:
```bash
pg_dump -h localhost -U postgres smif_gestao > backup.sql
```
Restore:
```bash
psql -h localhost -U postgres smif_gestao < backup.sql
```

## Procedimentos de atualização
Para os servidores oficiais, use sempre os documentos de deploy sem Docker:
- Desenvolvimento: [`DEPLOY_DESENVOLVIMENTO.md`](./DEPLOY_DESENVOLVIMENTO.md) (`172.16.31.177`)
- Produção: [`DEPLOY_PRODUCAO.md`](./DEPLOY_PRODUCAO.md) (`172.16.31.178`)

O fluxo Docker é legado/local e não deve ser usado para publicar nos servidores `172.16.31.177` ou `172.16.31.178`.

## Manual rápido
- TI: Admin RBAC, usuários, localidades, especialidades, auditoria.
- CIPAVD: visão nacional, reuniões, checklists, geração de tarefas.
- GSD: visão local, tarefas, relatórios.
