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
  'gantt',
  'view',
  'LOCALITY_SPECIALTY'::"PermissionScope",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM "Permission"
  WHERE "resource" = 'gantt'
    AND "action" = 'view'
    AND "scope" = 'LOCALITY_SPECIALTY'::"PermissionScope"
);

INSERT INTO "RolePermission" (
  "id",
  "roleId",
  "permissionId"
)
SELECT
  concat('rolperm_', gen_random_uuid()::text),
  r."id",
  p."id"
FROM "Role" r
JOIN "Permission" p
  ON p."resource" = 'gantt'
 AND p."action" = 'view'
 AND p."scope" = 'LOCALITY_SPECIALTY'::"PermissionScope"
WHERE r."name" = 'Admin Especialidade Local'
  AND NOT EXISTS (
    SELECT 1
    FROM "RolePermission" rp
    WHERE rp."roleId" = r."id"
      AND rp."permissionId" = p."id"
  );
