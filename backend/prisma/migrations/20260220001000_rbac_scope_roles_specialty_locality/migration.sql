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
  v.resource,
  v.action,
  v.scope::"PermissionScope",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  VALUES
    ('task_instances', 'view', 'SPECIALTY'),
    ('task_instances', 'update', 'SPECIALTY'),
    ('reports', 'view', 'SPECIALTY'),
    ('reports', 'upload', 'SPECIALTY'),
    ('reports', 'download', 'SPECIALTY'),
    ('dashboard', 'view', 'SPECIALTY'),
    ('gantt', 'view', 'SPECIALTY'),
    ('gantt', 'view', 'LOCALITY_SPECIALTY'),
    ('calendar', 'view', 'SPECIALTY'),
    ('search', 'view', 'SPECIALTY'),
    ('notices', 'view', 'SPECIALTY'),
    ('notices', 'create', 'SPECIALTY'),
    ('notices', 'update', 'SPECIALTY'),
    ('notices', 'delete', 'SPECIALTY'),
    ('notices', 'pin', 'SPECIALTY'),
    ('checklists', 'view', 'SPECIALTY'),
    ('checklists', 'update', 'SPECIALTY'),
    ('org_chart', 'view', 'SPECIALTY')
) AS v(resource, action, scope)
WHERE NOT EXISTS (
  SELECT 1
  FROM "Permission" p
  WHERE p."resource" = v.resource
    AND p."action" = v.action
    AND p."scope" = v.scope::"PermissionScope"
);

INSERT INTO "Role" (
  "id",
  "name",
  "description",
  "isSystemRole",
  "wildcard",
  "flagsJson",
  "constraintsTemplateJson",
  "createdAt",
  "updatedAt"
)
VALUES (
  concat('role_', gen_random_uuid()::text),
  'Admin Especialidade Nacional',
  'Administra dados da especialidade em todas as localidades',
  true,
  false,
  NULL,
  '{"specialtyId":"$user.specialtyId"}'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("name") DO UPDATE
SET
  "description" = EXCLUDED."description",
  "isSystemRole" = EXCLUDED."isSystemRole",
  "wildcard" = EXCLUDED."wildcard",
  "constraintsTemplateJson" = EXCLUDED."constraintsTemplateJson",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "Role" (
  "id",
  "name",
  "description",
  "isSystemRole",
  "wildcard",
  "flagsJson",
  "constraintsTemplateJson",
  "createdAt",
  "updatedAt"
)
VALUES (
  concat('role_', gen_random_uuid()::text),
  'Admin Localidade',
  'Administra dados de todas as especialidades da localidade',
  true,
  false,
  NULL,
  '{"localityId":"$user.localityId"}'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("name") DO UPDATE
SET
  "description" = EXCLUDED."description",
  "isSystemRole" = EXCLUDED."isSystemRole",
  "wildcard" = EXCLUDED."wildcard",
  "constraintsTemplateJson" = EXCLUDED."constraintsTemplateJson",
  "updatedAt" = CURRENT_TIMESTAMP;

WITH matrix(role_name, resource, action, scope) AS (
  VALUES
    ('Admin Especialidade Local', 'gantt', 'view', 'LOCALITY_SPECIALTY'),

    ('Admin Especialidade Nacional', 'task_instances', 'view', 'SPECIALTY'),
    ('Admin Especialidade Nacional', 'task_instances', 'update', 'SPECIALTY'),
    ('Admin Especialidade Nacional', 'reports', 'view', 'SPECIALTY'),
    ('Admin Especialidade Nacional', 'reports', 'upload', 'SPECIALTY'),
    ('Admin Especialidade Nacional', 'reports', 'download', 'SPECIALTY'),
    ('Admin Especialidade Nacional', 'dashboard', 'view', 'SPECIALTY'),
    ('Admin Especialidade Nacional', 'gantt', 'view', 'SPECIALTY'),
    ('Admin Especialidade Nacional', 'calendar', 'view', 'SPECIALTY'),
    ('Admin Especialidade Nacional', 'search', 'view', 'SPECIALTY'),
    ('Admin Especialidade Nacional', 'notices', 'view', 'SPECIALTY'),
    ('Admin Especialidade Nacional', 'notices', 'create', 'SPECIALTY'),
    ('Admin Especialidade Nacional', 'notices', 'update', 'SPECIALTY'),
    ('Admin Especialidade Nacional', 'notices', 'delete', 'SPECIALTY'),
    ('Admin Especialidade Nacional', 'notices', 'pin', 'SPECIALTY'),
    ('Admin Especialidade Nacional', 'checklists', 'view', 'SPECIALTY'),
    ('Admin Especialidade Nacional', 'checklists', 'update', 'SPECIALTY'),
    ('Admin Especialidade Nacional', 'org_chart', 'view', 'SPECIALTY'),

    ('Admin Localidade', 'phases', 'view', 'LOCALITY'),
    ('Admin Localidade', 'task_instances', 'view', 'LOCALITY'),
    ('Admin Localidade', 'task_instances', 'update', 'LOCALITY'),
    ('Admin Localidade', 'task_instances', 'assign', 'LOCALITY'),
    ('Admin Localidade', 'reports', 'view', 'LOCALITY'),
    ('Admin Localidade', 'reports', 'upload', 'LOCALITY'),
    ('Admin Localidade', 'reports', 'download', 'LOCALITY'),
    ('Admin Localidade', 'dashboard', 'view', 'LOCALITY'),
    ('Admin Localidade', 'gantt', 'view', 'LOCALITY'),
    ('Admin Localidade', 'calendar', 'view', 'LOCALITY'),
    ('Admin Localidade', 'search', 'view', 'LOCALITY'),
    ('Admin Localidade', 'notices', 'view', 'LOCALITY'),
    ('Admin Localidade', 'notices', 'create', 'LOCALITY'),
    ('Admin Localidade', 'notices', 'update', 'LOCALITY'),
    ('Admin Localidade', 'notices', 'delete', 'LOCALITY'),
    ('Admin Localidade', 'notices', 'pin', 'LOCALITY'),
    ('Admin Localidade', 'checklists', 'view', 'LOCALITY'),
    ('Admin Localidade', 'checklists', 'update', 'LOCALITY'),
    ('Admin Localidade', 'org_chart', 'view', 'LOCALITY')
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
