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
  'postos',
  'view',
  'NATIONAL'::"PermissionScope",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM "Permission" p
  WHERE p."resource" = 'postos'
    AND p."action" = 'view'
    AND p."scope" = 'NATIONAL'::"PermissionScope"
);

WITH matrix(role_name, resource, action, scope) AS (
  VALUES
    ('CPCA', 'postos', 'view', 'NATIONAL'),
    ('Coordenação CIPAVD', 'postos', 'view', 'NATIONAL'),
    ('COMGEP', 'postos', 'view', 'NATIONAL'),
    ('Comandante COMGEP', 'postos', 'view', 'NATIONAL')
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
