# RBAC_IMPORT_EXPORT — Import/Export de permissões (Admin TI)

Objetivo: permitir que a TI **exporte** e **importe** a matriz RBAC (roles → permissions), facilitando manutenção em massa.

## 1) Formato de arquivo
JSON no formato:
```json
{
  "version": "1.0",
  "exportedAt": "2026-02-02T00:00:00Z",
  "roles": [
    {
      "name": "GSD Localidade",
      "description": "Gestão local do programa",
      "isSystemRole": true,
      "wildcard": false,
      "permissions": [
        { "resource": "task_instances", "action": "view", "scope": "LOCALITY" }
      ],
      "constraintsTemplate": { "localityId": "$user.localityId" }
    }
  ]
}
```

## 2) Regras de importação
- Se `role.name` existir:
  - Atualiza `description`, `wildcard`, e substitui totalmente o conjunto de permissões (modo **replace**).
- Se `role.name` não existir:
  - Cria role.
- Para roles `isSystemRole=true`:
  - **Pode** atualizar permissões, mas **não pode** deletar a role.
- Permissões inexistentes no catálogo:
  - Rejeitar import com 400 `VALIDATION_ERROR` listando itens inválidos.

## 3) Endpoints (Admin TI)
### GET /admin/rbac/export
- Retorna a matriz RBAC no formato acima.

### POST /admin/rbac/import?mode=replace
Body: JSON da matriz.
- `mode=replace` (default): substitui permissões de cada role importada.
- `mode=merge`: adiciona permissões novas sem remover as antigas.

Respostas:
- 200 `{ "updatedRoles": 5, "createdRoles": 1, "warnings": [] }`
- 400 `VALIDATION_ERROR` com `details.invalidPermissions`

## 4) UI (Admin → RBAC)
### 4.1 Tela Matriz
- Lista de Roles à esquerda
- Grid de permissões à direita (resource x action x scope)
- Busca e filtros por resource/action
- Botão:
  - Exportar JSON
  - Importar JSON
  - Clonar role

### 4.2 Proteções
- Só TI vê esta tela.
- Banner “Sistema crítico” e confirmação antes de importar (modal com resumo do diff).

## 5) Diff visual (recomendado)
Ao carregar arquivo no frontend:
- Calcular diff (roles novas, permissões adicionadas/removidas)
- Mostrar resumo antes de confirmar import.
