# ADMIN_RBAC_UI_SPEC — Tela RBAC (TI) + Diff de Import

## 1) Componentes
- `RoleList` (left): lista roles + search + create/clone
- `PermissionMatrixGrid` (right): grid com filtros (resource/action/scope)
- `ImportDialog`:
  - upload JSON
  - parse e validar
  - mostrar diff
  - confirmar import
- `ExportButton`:
  - baixa JSON de /admin/rbac/export

## 2) Diff
Dado `current` e `incoming`:
- rolesCreated: roles em incoming que não existem em current
- rolesUpdated: roles existentes com mudanças
- permsAdded: por role, itens presentes em incoming e ausentes em current
- permsRemoved: por role, itens ausentes em incoming e presentes em current (apenas modo replace)

UI:
- Tabela com colunas: Role | Added | Removed | Observações
- Botão “ver detalhes” (listagem por perm string `resource:action:scope`)

## 3) Validação frontend
- Verificar estrutura mínima (version, roles[])
- Verificar que cada permission possui resource/action/scope
- Scope deve ser um dos ENUMS.PermissionScope
- Se falhar, bloquear e mostrar erros.

## 4) UX
- Import tem “stepper”:
  1) Selecionar arquivo
  2) Revisar diff
  3) Confirmar (double confirm)
- Snackbar de sucesso/erro e link “ver auditoria”.
