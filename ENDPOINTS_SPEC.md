# ENDPOINTS_SPEC — Contratos de API (detalhado)

> Padrões:
- Autenticação: `Authorization: Bearer <accessToken>`
- Paginação: `?page=1&pageSize=25`
- Ordenação: `?sort=createdAt:desc`
- Erros: `{ "message": "...", "code": "...", "details": ... }`

## Auth
- POST /auth/login
- POST /auth/refresh
- GET /auth/me (retorna user + permissions + scopes + flags)

## Admin TI
- CRUD /localities, /specialties, /users
- CRUD /roles, GET /permissions
- POST /roles/:id/clone
- PUT /roles/:id/permissions
- GET /audit-logs

## Meetings
- CRUD /meetings
- POST /meetings/:id/decisions
- POST /meetings/:id/generate-tasks

## Tasks
- CRUD /task-templates
- CRUD /task-instances
- PUT /task-instances/:id/status (bloqueia DONE sem report quando obrigatório)
- PUT /task-instances/:id/assign
- GET /task-instances/gantt
- GET /task-instances/calendar?year=2026

## Reports
- POST /reports/upload (multipart)
- GET /reports/:id/download
- PUT /reports/:id/approve (opcional)

## Notices / Checklists / KPIs / Elos / Org
- CRUD /notices
- CRUD /checklists + /checklist-items
- PUT /checklist-item-status/batch
- CRUD /kpis + /kpis/:id/values + GET /kpis/dashboard
- CRUD /elos
- CRUD /org-chart
