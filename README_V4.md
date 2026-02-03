# V4 — Aceleradores para Codex (Task Core)

Este pacote adiciona artefatos para acelerar o desenvolvimento do core (fases/tarefas/prazos/progresso/gantt/calendário),
reduzindo a necessidade de decisões durante a geração do código.

## Arquivos novos (principais)
- DOMAIN_TASKS.md — regras fechadas do core
- OPENAPI_TASKS_EXPANDED.yaml — contratos de API do core (pronto para gerar client)
- RBAC_MATRIX.json — matriz inicial de permissões (roles→perms) focada no core
- ENUMS.json / ERROR_CODES.json — enums e catálogo de erros padronizados
- docs/sample_data/* + SEED_DEMO.ts — dados e seed de demo
- e2e/PLAYWRIGHT_TASK_CORE.spec.ts — E2E do core
- GANTT_ADAPTER_SPEC.md / CALENDAR_ADAPTER_SPEC.md — adapters
- scripts/generate-client.ts — geração de types a partir do OpenAPI

## Sugestão de “ordem Codex”
1) Implementar API conforme OPENAPI_TASKS_EXPANDED.yaml + regras de DOMAIN_TASKS.md.
2) Implementar UI conforme WIREFRAMES_TASK_CORE.md e FRONTEND_COMPONENT_REQUIREMENTS.md.
3) Rodar seed demo e validar E2E.
