# V5 — Turbo máximo para Codex (Admin RBAC + OpenAPI Full + Hooks)

Este pacote inclui **tudo do v4** e adiciona:
- `OPENAPI_FULL.yaml` (spec completa do sistema)
- `docs/OPENAPI_FULL.yaml` (mesma spec para codegen)
- `RBAC_IMPORT_EXPORT.md` + `ADMIN_RBAC_UI_SPEC.md` (import/export + diff)
- `frontend/src/api/*` (client + queryKeys + hooks) para padronizar consumo de API e evitar calls divergentes
- `scripts/generate-client.ts` atualizado (core ou full)

Sugestão de uso:
1) Gerar types: `node scripts/generate-client.ts full`
2) Implementar backend conforme OpenAPI (full) e regras `DOMAIN_TASKS.md`
3) Implementar UI core (Tasks/Gantt/Calendar/Dashboards) usando hooks
4) Implementar Admin RBAC import/export seguindo specs
