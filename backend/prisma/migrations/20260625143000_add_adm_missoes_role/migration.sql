-- Create the restricted mission administration profile used by the CIPAVD Missions menu.
WITH missions_permissions(resource, action, scope) AS (
  VALUES
    ('missions', 'view', 'NATIONAL'),
    ('missions', 'create', 'NATIONAL'),
    ('missions', 'update', 'NATIONAL'),
    ('missions', 'download', 'NATIONAL')
)
INSERT INTO "Permission" (
  "id",
  "resource",
  "action",
  "scope",
  "description",
  "createdAt",
  "updatedAt"
)
SELECT
  concat('perm_', gen_random_uuid()::text),
  p.resource,
  p.action,
  p.scope::"PermissionScope",
  p.action || ' on ' || p.resource || ' (' || p.scope || ')',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM missions_permissions p
WHERE NOT EXISTS (
  SELECT 1
  FROM "Permission" existing
  WHERE existing."resource" = p.resource
    AND existing."action" = p.action
    AND existing."scope" = p.scope::"PermissionScope"
);

INSERT INTO "Role" (
  "id",
  "name",
  "description",
  "isSystemRole",
  "wildcard",
  "createdAt",
  "updatedAt"
)
VALUES (
  concat('role_', gen_random_uuid()::text),
  'Adm Missões',
  'Administração restrita de missões CIPAVD e SMIF',
  true,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("name") DO UPDATE
SET
  "description" = EXCLUDED."description",
  "isSystemRole" = true,
  "wildcard" = false,
  "updatedAt" = CURRENT_TIMESTAMP;

WITH matrix(role_name, resource, action, scope) AS (
  VALUES
    ('Adm Missões', 'missions', 'view', 'NATIONAL'),
    ('Adm Missões', 'missions', 'create', 'NATIONAL'),
    ('Adm Missões', 'missions', 'update', 'NATIONAL'),
    ('Adm Missões', 'missions', 'download', 'NATIONAL')
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
