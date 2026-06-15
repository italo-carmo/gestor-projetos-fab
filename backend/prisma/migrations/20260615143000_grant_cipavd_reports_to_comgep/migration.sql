-- Ensure the CIPAVD reports repository is visible to COMGEP and TI after deploy.
WITH cipavd_reports_permissions(resource, action, scope) AS (
  VALUES
    ('cipavd_reports', 'view', 'NATIONAL'),
    ('cipavd_reports', 'create', 'NATIONAL'),
    ('cipavd_reports', 'update', 'NATIONAL'),
    ('cipavd_reports', 'delete', 'NATIONAL'),
    ('cipavd_reports', 'upload', 'NATIONAL'),
    ('cipavd_reports', 'download', 'NATIONAL')
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
FROM cipavd_reports_permissions p
WHERE NOT EXISTS (
  SELECT 1
  FROM "Permission" existing
  WHERE existing."resource" = p.resource
    AND existing."action" = p.action
    AND existing."scope" = p.scope::"PermissionScope"
);

WITH matrix(role_name, resource, action, scope) AS (
  VALUES
    ('COMGEP', 'cipavd_reports', 'view', 'NATIONAL'),
    ('COMGEP', 'cipavd_reports', 'create', 'NATIONAL'),
    ('COMGEP', 'cipavd_reports', 'update', 'NATIONAL'),
    ('COMGEP', 'cipavd_reports', 'delete', 'NATIONAL'),
    ('COMGEP', 'cipavd_reports', 'upload', 'NATIONAL'),
    ('COMGEP', 'cipavd_reports', 'download', 'NATIONAL'),
    ('Comandante COMGEP', 'cipavd_reports', 'view', 'NATIONAL'),
    ('Comandante COMGEP', 'cipavd_reports', 'create', 'NATIONAL'),
    ('Comandante COMGEP', 'cipavd_reports', 'update', 'NATIONAL'),
    ('Comandante COMGEP', 'cipavd_reports', 'delete', 'NATIONAL'),
    ('Comandante COMGEP', 'cipavd_reports', 'upload', 'NATIONAL'),
    ('Comandante COMGEP', 'cipavd_reports', 'download', 'NATIONAL'),
    ('TI', 'cipavd_reports', 'view', 'NATIONAL'),
    ('TI', 'cipavd_reports', 'create', 'NATIONAL'),
    ('TI', 'cipavd_reports', 'update', 'NATIONAL'),
    ('TI', 'cipavd_reports', 'delete', 'NATIONAL'),
    ('TI', 'cipavd_reports', 'upload', 'NATIONAL'),
    ('TI', 'cipavd_reports', 'download', 'NATIONAL')
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
