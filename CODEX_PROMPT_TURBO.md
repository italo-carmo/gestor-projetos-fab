# PROMPT


## V4 — Fonte de verdade adicional (obrigatório seguir)
- DEPLOY_DESENVOLVIMENTO.md: deploy em desenvolvimento sempre no `172.16.31.177`
- DEPLOY_PRODUCAO.md: deploy de producao sempre no `172.16.31.178`
- DOMAIN_TASKS.md
- OPENAPI_TASKS_EXPANDED.yaml
- RBAC_MATRIX.json
- ENUMS.json
- ERROR_CODES.json
- WIREFRAMES_TASK_CORE.md e FRONTEND_COMPONENT_REQUIREMENTS.md
- docs/sample_data/ e SEED_DEMO.ts
- e2e/PLAYWRIGHT_TASK_CORE.spec.ts


## V5 — Fonte de verdade adicional (obrigatório seguir)
- OPENAPI_FULL.yaml (ou docs/OPENAPI_FULL.yaml)
- RBAC_IMPORT_EXPORT.md
- ADMIN_RBAC_UI_SPEC.md
- frontend/src/api/client.ts, queryKeys.ts, hooks.ts
- scripts/generate-client.ts

## Deploy — regra obrigatoria
- Desenvolvimento: `172.16.31.177`
- Producao: `172.16.31.178`
- Nunca misturar os ambientes. Antes de publicar, confirmar se o pedido e para desenvolvimento ou producao e seguir o `.md` correspondente.
