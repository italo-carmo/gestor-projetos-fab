CREATE TABLE IF NOT EXISTS "CpcaChecklistItem" (
  "id" TEXT NOT NULL,
  "omId" TEXT NOT NULL,
  "itemKey" TEXT NOT NULL,
  "isCompleted" BOOLEAN NOT NULL DEFAULT false,
  "completedAt" TIMESTAMP(3),
  "details" TEXT,
  "speakerName" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CpcaChecklistItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CpcaChecklistItem_omId_fkey" FOREIGN KEY ("omId") REFERENCES "Om"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CpcaChecklistItem_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CpcaChecklistItem_omId_itemKey_key"
  ON "CpcaChecklistItem"("omId", "itemKey");
CREATE INDEX IF NOT EXISTS "CpcaChecklistItem_omId_isCompleted_idx"
  ON "CpcaChecklistItem"("omId", "isCompleted");
CREATE INDEX IF NOT EXISTS "CpcaChecklistItem_updatedByUserId_idx"
  ON "CpcaChecklistItem"("updatedByUserId");
CREATE INDEX IF NOT EXISTS "CpcaChecklistItem_itemKey_idx"
  ON "CpcaChecklistItem"("itemKey");

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
  'cpca_checklist',
  'view',
  'NATIONAL'::"PermissionScope",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM "Permission" p
  WHERE p."resource" = 'cpca_checklist'
    AND p."action" = 'view'
    AND p."scope" = 'NATIONAL'::"PermissionScope"
);

WITH matrix(role_name, resource, action, scope) AS (
  VALUES
    ('TI', 'cpca_checklist', 'view', 'NATIONAL'),
    ('Coordenação CIPAVD', 'cpca_checklist', 'view', 'NATIONAL'),
    ('Coordenacao CIPAVD', 'cpca_checklist', 'view', 'NATIONAL'),
    ('COMGEP', 'cpca_checklist', 'view', 'NATIONAL'),
    ('Comandante COMGEP', 'cpca_checklist', 'view', 'NATIONAL')
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
