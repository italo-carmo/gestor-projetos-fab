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
  'CIPAVD',
  'Acesso exclusivo ao bloco CIPAVD',
  true,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("name") DO UPDATE
SET
  "description" = EXCLUDED."description",
  "isSystemRole" = EXCLUDED."isSystemRole",
  "wildcard" = EXCLUDED."wildcard",
  "updatedAt" = CURRENT_TIMESTAMP;

WITH matrix(resource, action, scope) AS (
  VALUES
    ('users', 'view', 'NATIONAL'),
    ('phases', 'view', 'NATIONAL'),
    ('task_templates', 'view', 'NATIONAL'),
    ('task_templates', 'create', 'NATIONAL'),
    ('task_templates', 'update', 'NATIONAL'),
    ('task_instances', 'view', 'NATIONAL'),
    ('task_instances', 'create', 'NATIONAL'),
    ('task_instances', 'update', 'NATIONAL'),
    ('task_instances', 'assign', 'NATIONAL'),
    ('task_instances', 'export', 'NATIONAL'),
    ('reports', 'view', 'NATIONAL'),
    ('reports', 'create', 'NATIONAL'),
    ('reports', 'update', 'NATIONAL'),
    ('reports', 'upload', 'NATIONAL'),
    ('reports', 'download', 'NATIONAL'),
    ('reports', 'approve', 'NATIONAL'),
    ('meetings', 'view', 'NATIONAL'),
    ('meetings', 'create', 'NATIONAL'),
    ('meetings', 'update', 'NATIONAL'),
    ('tasks', 'generate_from_meeting', 'NATIONAL'),
    ('notices', 'view', 'NATIONAL'),
    ('notices', 'create', 'NATIONAL'),
    ('notices', 'update', 'NATIONAL'),
    ('notices', 'delete', 'NATIONAL'),
    ('notices', 'pin', 'NATIONAL'),
    ('org_chart', 'view', 'NATIONAL'),
    ('localities', 'view', 'NATIONAL'),
    ('specialties', 'view', 'NATIONAL'),
    ('dashboard', 'view', 'NATIONAL'),
    ('gantt', 'view', 'NATIONAL'),
    ('calendar', 'view', 'NATIONAL'),
    ('search', 'view', 'NATIONAL')
),
role_ref AS (
  SELECT "id"
  FROM "Role"
  WHERE "name" = 'CIPAVD'
  LIMIT 1
)
DELETE FROM "RolePermission" rp
USING role_ref rr
WHERE rp."roleId" = rr."id"
  AND NOT EXISTS (
    SELECT 1
    FROM matrix m
    JOIN "Permission" p
      ON p."resource" = m.resource
     AND p."action" = m.action
     AND p."scope" = m.scope::"PermissionScope"
    WHERE p."id" = rp."permissionId"
  );

WITH matrix(resource, action, scope) AS (
  VALUES
    ('users', 'view', 'NATIONAL'),
    ('phases', 'view', 'NATIONAL'),
    ('task_templates', 'view', 'NATIONAL'),
    ('task_templates', 'create', 'NATIONAL'),
    ('task_templates', 'update', 'NATIONAL'),
    ('task_instances', 'view', 'NATIONAL'),
    ('task_instances', 'create', 'NATIONAL'),
    ('task_instances', 'update', 'NATIONAL'),
    ('task_instances', 'assign', 'NATIONAL'),
    ('task_instances', 'export', 'NATIONAL'),
    ('reports', 'view', 'NATIONAL'),
    ('reports', 'create', 'NATIONAL'),
    ('reports', 'update', 'NATIONAL'),
    ('reports', 'upload', 'NATIONAL'),
    ('reports', 'download', 'NATIONAL'),
    ('reports', 'approve', 'NATIONAL'),
    ('meetings', 'view', 'NATIONAL'),
    ('meetings', 'create', 'NATIONAL'),
    ('meetings', 'update', 'NATIONAL'),
    ('tasks', 'generate_from_meeting', 'NATIONAL'),
    ('notices', 'view', 'NATIONAL'),
    ('notices', 'create', 'NATIONAL'),
    ('notices', 'update', 'NATIONAL'),
    ('notices', 'delete', 'NATIONAL'),
    ('notices', 'pin', 'NATIONAL'),
    ('org_chart', 'view', 'NATIONAL'),
    ('localities', 'view', 'NATIONAL'),
    ('specialties', 'view', 'NATIONAL'),
    ('dashboard', 'view', 'NATIONAL'),
    ('gantt', 'view', 'NATIONAL'),
    ('calendar', 'view', 'NATIONAL'),
    ('search', 'view', 'NATIONAL')
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
  ON r."name" = 'CIPAVD'
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
