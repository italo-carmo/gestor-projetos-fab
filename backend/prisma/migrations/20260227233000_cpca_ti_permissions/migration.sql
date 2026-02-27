WITH cpca_permissions(resource, action, scope) AS (
  VALUES
    ('cpca_cases', 'view', 'NATIONAL'),
    ('cpca_cases', 'create', 'NATIONAL'),
    ('cpca_cases', 'update', 'NATIONAL'),
    ('cpca_cases', 'comment', 'NATIONAL')
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
FROM cpca_permissions p
WHERE NOT EXISTS (
  SELECT 1
  FROM "Permission" existing
  WHERE existing."resource" = p.resource
    AND existing."action" = p.action
    AND existing."scope" = p.scope::"PermissionScope"
);

WITH matrix(role_name, resource, action, scope) AS (
  VALUES
    ('TI', 'cpca_cases', 'view', 'NATIONAL'),
    ('TI', 'cpca_cases', 'create', 'NATIONAL'),
    ('TI', 'cpca_cases', 'update', 'NATIONAL'),
    ('TI', 'cpca_cases', 'comment', 'NATIONAL')
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
