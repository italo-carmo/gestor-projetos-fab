# CODEX_ADDENDUM — Pacote v2 (aumentado)
Use também estes arquivos como fonte de verdade:
- DEPLOY_DESENVOLVIMENTO.md (deploy em desenvolvimento: 172.16.31.177)
- DEPLOY_PRODUCAO.md (deploy em producao: 172.16.31.178)
- SEED_FULL.md (catálogo de permissões)
- SEED_ROLES_SUGGESTION.md (perfis iniciais sugeridos)
- ENDPOINTS_SPEC.md (contratos)
- UI_COMPONENTS.md (padrões de UI)
- SQL_IMPORT_TEMPLATES/ (CSVs para import)

## Novidades v3
- PERMISSIONS_SEED.ts (seed pronto RBAC)
- OPENAPI.yaml (Swagger base)
- FIGMA_GUIDE.md (design tokens + guidelines)

## Regra fixa de deploy
- Desenvolvimento sempre em `172.16.31.177`.
- Producao sempre em `172.16.31.178`.
- Antes de qualquer deploy, confirmar explicitamente o ambiente solicitado e usar o arquivo de deploy correspondente.
