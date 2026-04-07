WITH cpca_delete_permissions(resource, action, scope) AS (
  VALUES
    ('cpca_cases', 'delete', 'LOCALITY'),
    ('cpca_cases', 'delete', 'NATIONAL')
)
INSERT INTO "Permission" (
  "id",
  "resource",
  "action",
  "scope",
  "createdAt",
  "updatedAt"
)
SELECT
  concat('perm_', gen_random_uuid()::text),
  p.resource,
  p.action,
  p.scope::"PermissionScope",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM cpca_delete_permissions p
WHERE NOT EXISTS (
  SELECT 1
  FROM "Permission" existing
  WHERE existing."resource" = p.resource
    AND existing."action" = p.action
    AND existing."scope" = p.scope::"PermissionScope"
);

WITH matrix(role_name, resource, action, scope) AS (
  VALUES
    ('TI', 'cpca_cases', 'delete', 'NATIONAL'),
    ('Coordenação CIPAVD', 'cpca_cases', 'delete', 'NATIONAL'),
    ('Coordenacao CIPAVD', 'cpca_cases', 'delete', 'NATIONAL')
)
INSERT INTO "RolePermission" (
  "id",
  "roleId",
  "permissionId"
)
SELECT
  concat('rolperm_', gen_random_uuid()::text),
  r."id",
  p."id"
FROM matrix m
JOIN "Role" r
  ON r."name" = m.role_name
JOIN "Permission" p
  ON p."resource" = m.resource
 AND p."action" = m.action
 AND p."scope" = m.scope::"PermissionScope"
WHERE NOT EXISTS (
  SELECT 1
  FROM "RolePermission" rp
  WHERE rp."roleId" = r."id"
    AND rp."permissionId" = p."id"
);
