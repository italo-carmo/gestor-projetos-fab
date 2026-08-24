CREATE TABLE "Odgsa" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Odgsa_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OdgsaOm" (
  "id" TEXT NOT NULL,
  "odgsaId" TEXT NOT NULL,
  "omId" TEXT NOT NULL,
  "assignedById" TEXT,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OdgsaOm_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Odgsa_code_key" ON "Odgsa"("code");
CREATE UNIQUE INDEX "Odgsa_roleId_key" ON "Odgsa"("roleId");
CREATE INDEX "Odgsa_name_idx" ON "Odgsa"("name");
CREATE UNIQUE INDEX "OdgsaOm_omId_key" ON "OdgsaOm"("omId");
CREATE INDEX "OdgsaOm_odgsaId_idx" ON "OdgsaOm"("odgsaId");
CREATE INDEX "OdgsaOm_assignedById_idx" ON "OdgsaOm"("assignedById");

ALTER TABLE "Odgsa"
  ADD CONSTRAINT "Odgsa_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "Role"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OdgsaOm"
  ADD CONSTRAINT "OdgsaOm_odgsaId_fkey"
  FOREIGN KEY ("odgsaId") REFERENCES "Odgsa"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OdgsaOm"
  ADD CONSTRAINT "OdgsaOm_omId_fkey"
  FOREIGN KEY ("omId") REFERENCES "Om"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OdgsaOm"
  ADD CONSTRAINT "OdgsaOm_assignedById_fkey"
  FOREIGN KEY ("assignedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

WITH required_permissions(resource, action, scope, description) AS (
  VALUES
    ('odgsa_admin', 'view', 'NATIONAL', 'Consultar o cadastro de ODGSA'),
    ('odgsa_admin', 'create', 'NATIONAL', 'Criar ODGSA e seu papel de acesso'),
    ('odgsa_admin', 'update', 'NATIONAL', 'Atualizar o cadastro de ODGSA'),
    ('odgsa_oms', 'view', 'LOCALITY', 'Consultar OMs disponíveis e vinculadas ao próprio ODGSA'),
    ('odgsa_oms', 'update', 'LOCALITY', 'Vincular e desvincular OMs do próprio ODGSA'),
    ('cpca_dashboard', 'view', 'LOCALITY', 'Consultar indicadores CPCA no escopo local')
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
  p.description,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM required_permissions p
WHERE NOT EXISTS (
  SELECT 1
  FROM "Permission" existing
  WHERE existing."resource" = p.resource
    AND existing."action" = p.action
    AND existing."scope" = p.scope::"PermissionScope"
);

WITH ti_permissions(role_name, resource, action, scope) AS (
  VALUES
    ('TI', 'odgsa_admin', 'view', 'NATIONAL'),
    ('TI', 'odgsa_admin', 'create', 'NATIONAL'),
    ('TI', 'odgsa_admin', 'update', 'NATIONAL')
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
FROM ti_permissions target
JOIN "Role" r
  ON r."name" = target.role_name
JOIN "Permission" p
  ON p."resource" = target.resource
 AND p."action" = target.action
 AND p."scope" = target.scope::"PermissionScope"
WHERE NOT EXISTS (
  SELECT 1
  FROM "RolePermission" rp
  WHERE rp."roleId" = r."id"
    AND rp."permissionId" = p."id"
);
