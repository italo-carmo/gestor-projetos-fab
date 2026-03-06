CREATE TABLE "LessonLearnedPost" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdById" TEXT,
  "authorLabel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LessonLearnedPost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LessonLearnedPost_createdAt_idx" ON "LessonLearnedPost"("createdAt");
CREATE INDEX "LessonLearnedPost_createdById_createdAt_idx" ON "LessonLearnedPost"("createdById", "createdAt");

ALTER TABLE "LessonLearnedPost"
  ADD CONSTRAINT "LessonLearnedPost_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

WITH lessons_permissions(resource, action, scope) AS (
  VALUES
    ('lessons_learned', 'view', 'NATIONAL'),
    ('lessons_learned', 'create', 'NATIONAL'),
    ('lessons_learned', 'update', 'NATIONAL'),
    ('lessons_learned', 'delete', 'NATIONAL')
)
INSERT INTO "Permission" ("id", "resource", "action", "scope", "createdAt", "updatedAt")
SELECT
  concat('perm_', gen_random_uuid()::text),
  p.resource,
  p.action,
  p.scope::"PermissionScope",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM lessons_permissions p
WHERE NOT EXISTS (
  SELECT 1
  FROM "Permission" existing
  WHERE existing."resource" = p.resource
    AND existing."action" = p.action
    AND existing."scope" = p.scope::"PermissionScope"
);

WITH matrix(role_name, resource, action, scope) AS (
  VALUES
    ('Coordenação CIPAVD', 'lessons_learned', 'view', 'NATIONAL'),
    ('Coordenação CIPAVD', 'lessons_learned', 'create', 'NATIONAL'),
    ('Coordenação CIPAVD', 'lessons_learned', 'update', 'NATIONAL'),
    ('Coordenação CIPAVD', 'lessons_learned', 'delete', 'NATIONAL'),
    ('Coordenacao CIPAVD', 'lessons_learned', 'view', 'NATIONAL'),
    ('Coordenacao CIPAVD', 'lessons_learned', 'create', 'NATIONAL'),
    ('Coordenacao CIPAVD', 'lessons_learned', 'update', 'NATIONAL'),
    ('Coordenacao CIPAVD', 'lessons_learned', 'delete', 'NATIONAL'),
    ('TI', 'lessons_learned', 'view', 'NATIONAL'),
    ('TI', 'lessons_learned', 'create', 'NATIONAL'),
    ('TI', 'lessons_learned', 'update', 'NATIONAL'),
    ('TI', 'lessons_learned', 'delete', 'NATIONAL'),
    ('COMGEP', 'lessons_learned', 'view', 'NATIONAL'),
    ('Comandante COMGEP', 'lessons_learned', 'view', 'NATIONAL')
)
INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT
  concat('rolperm_', gen_random_uuid()::text),
  r."id",
  p."id"
FROM matrix m
JOIN "Role" r ON r."name" = m.role_name
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

