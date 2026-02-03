# SMIF Gestao - Monorepo

## Requisitos
- Node.js 20+
- Docker + Docker Compose

## Setup rapido

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
