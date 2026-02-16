# SMIF Gestao - Monorepo

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

## Deploy (produção)
1) Build e subir stack:
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

2) Aplicar migrations e seed (uma vez):
```bash
npm run prisma:migrate
npm run seed:demo
```

3) Acessos:
- App: `http://localhost:8080`
- API: `http://localhost:8080/api`

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
1) `git pull`
2) `docker compose -f docker-compose.prod.yml up -d --build`
3) `npm run prisma:migrate`

## Manual rápido
- TI: Admin RBAC, usuários, localidades, especialidades, auditoria.
- CIPAVD: visão nacional, reuniões, checklists, geração de tarefas.
- GSD: visão local, tarefas, relatórios.
