-- Boas Práticas: posts por localidade + comissão
CREATE TABLE "BestPracticePost" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "localityId" TEXT,
  "isCommission" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT,
  "authorLabel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BestPracticePost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BestPracticePost_isCommission_createdAt_idx" ON "BestPracticePost"("isCommission", "createdAt");
CREATE INDEX "BestPracticePost_localityId_createdAt_idx" ON "BestPracticePost"("localityId", "createdAt");
CREATE INDEX "BestPracticePost_createdById_createdAt_idx" ON "BestPracticePost"("createdById", "createdAt");

ALTER TABLE "BestPracticePost"
  ADD CONSTRAINT "BestPracticePost_localityId_fkey"
  FOREIGN KEY ("localityId") REFERENCES "Locality"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BestPracticePost"
  ADD CONSTRAINT "BestPracticePost_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

WITH best_practices_permissions(resource, action, scope) AS (
  VALUES
    ('best_practices', 'view', 'NATIONAL'),
    ('best_practices', 'create', 'NATIONAL'),
    ('best_practices', 'update', 'NATIONAL'),
    ('best_practices', 'delete', 'NATIONAL')
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
FROM best_practices_permissions p
WHERE NOT EXISTS (
  SELECT 1
  FROM "Permission" existing
  WHERE existing."resource" = p.resource
    AND existing."action" = p.action
    AND existing."scope" = p.scope::"PermissionScope"
);

WITH matrix(role_name, resource, action, scope) AS (
  VALUES
    ('Coordenação CIPAVD', 'best_practices', 'view', 'NATIONAL'),
    ('Coordenação CIPAVD', 'best_practices', 'create', 'NATIONAL'),
    ('Coordenação CIPAVD', 'best_practices', 'update', 'NATIONAL'),
    ('Coordenação CIPAVD', 'best_practices', 'delete', 'NATIONAL'),
    ('Coordenacao CIPAVD', 'best_practices', 'view', 'NATIONAL'),
    ('Coordenacao CIPAVD', 'best_practices', 'create', 'NATIONAL'),
    ('Coordenacao CIPAVD', 'best_practices', 'update', 'NATIONAL'),
    ('Coordenacao CIPAVD', 'best_practices', 'delete', 'NATIONAL'),
    ('TI', 'best_practices', 'view', 'NATIONAL'),
    ('COMGEP', 'best_practices', 'view', 'NATIONAL'),
    ('Comandante COMGEP', 'best_practices', 'view', 'NATIONAL')
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

