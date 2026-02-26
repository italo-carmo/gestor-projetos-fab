-- Ensure COMGEP can load localities for the global locality header filter.
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
  'localities',
  'view',
  'NATIONAL'::"PermissionScope",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM "Permission"
  WHERE "resource" = 'localities'
    AND "action" = 'view'
    AND "scope" = 'NATIONAL'::"PermissionScope"
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
  ON p."resource" = 'localities'
 AND p."action" = 'view'
 AND p."scope" = 'NATIONAL'::"PermissionScope"
WHERE r."name" IN ('COMGEP', 'Comandante COMGEP')
  AND NOT EXISTS (
    SELECT 1
    FROM "RolePermission" rp
    WHERE rp."roleId" = r."id"
      AND rp."permissionId" = p."id"
  );
