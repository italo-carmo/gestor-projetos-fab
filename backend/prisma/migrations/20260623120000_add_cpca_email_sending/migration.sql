CREATE TYPE "CpcaEmailDispatchStatus" AS ENUM ('QUEUED', 'SENT', 'PARTIAL', 'FAILED');

CREATE TYPE "CpcaEmailDeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

CREATE TABLE "CpcaEmailTemplate" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "bodyHtml" TEXT NOT NULL,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CpcaEmailTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CpcaEmailTemplateAttachment" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CpcaEmailTemplateAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CpcaEmailDispatch" (
  "id" TEXT NOT NULL,
  "templateId" TEXT,
  "subject" TEXT NOT NULL,
  "bodyHtml" TEXT NOT NULL,
  "status" "CpcaEmailDispatchStatus" NOT NULL DEFAULT 'QUEUED',
  "totalRecipients" INTEGER NOT NULL DEFAULT 0,
  "sentCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CpcaEmailDispatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CpcaEmailDelivery" (
  "id" TEXT NOT NULL,
  "dispatchId" TEXT NOT NULL,
  "templateId" TEXT,
  "omId" TEXT,
  "presidentUserId" TEXT,
  "omCode" TEXT NOT NULL,
  "omName" TEXT NOT NULL,
  "recipientName" TEXT NOT NULL,
  "recipientEmail" TEXT NOT NULL,
  "status" "CpcaEmailDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
  "errorMessage" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CpcaEmailDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CpcaEmailTemplateAttachment_storageKey_key"
  ON "CpcaEmailTemplateAttachment"("storageKey");

CREATE INDEX "CpcaEmailTemplate_updatedAt_idx"
  ON "CpcaEmailTemplate"("updatedAt");

CREATE INDEX "CpcaEmailTemplate_createdById_idx"
  ON "CpcaEmailTemplate"("createdById");

CREATE INDEX "CpcaEmailTemplate_updatedById_idx"
  ON "CpcaEmailTemplate"("updatedById");

CREATE INDEX "CpcaEmailTemplateAttachment_templateId_idx"
  ON "CpcaEmailTemplateAttachment"("templateId");

CREATE INDEX "CpcaEmailDispatch_createdAt_idx"
  ON "CpcaEmailDispatch"("createdAt");

CREATE INDEX "CpcaEmailDispatch_status_createdAt_idx"
  ON "CpcaEmailDispatch"("status", "createdAt");

CREATE INDEX "CpcaEmailDispatch_templateId_idx"
  ON "CpcaEmailDispatch"("templateId");

CREATE INDEX "CpcaEmailDispatch_createdById_idx"
  ON "CpcaEmailDispatch"("createdById");

CREATE INDEX "CpcaEmailDelivery_dispatchId_status_idx"
  ON "CpcaEmailDelivery"("dispatchId", "status");

CREATE INDEX "CpcaEmailDelivery_templateId_idx"
  ON "CpcaEmailDelivery"("templateId");

CREATE INDEX "CpcaEmailDelivery_omId_idx"
  ON "CpcaEmailDelivery"("omId");

CREATE INDEX "CpcaEmailDelivery_presidentUserId_idx"
  ON "CpcaEmailDelivery"("presidentUserId");

CREATE INDEX "CpcaEmailDelivery_recipientEmail_idx"
  ON "CpcaEmailDelivery"("recipientEmail");

ALTER TABLE "CpcaEmailTemplate"
ADD CONSTRAINT "CpcaEmailTemplate_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CpcaEmailTemplate"
ADD CONSTRAINT "CpcaEmailTemplate_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CpcaEmailTemplateAttachment"
ADD CONSTRAINT "CpcaEmailTemplateAttachment_templateId_fkey"
FOREIGN KEY ("templateId") REFERENCES "CpcaEmailTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CpcaEmailDispatch"
ADD CONSTRAINT "CpcaEmailDispatch_templateId_fkey"
FOREIGN KEY ("templateId") REFERENCES "CpcaEmailTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CpcaEmailDispatch"
ADD CONSTRAINT "CpcaEmailDispatch_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CpcaEmailDelivery"
ADD CONSTRAINT "CpcaEmailDelivery_dispatchId_fkey"
FOREIGN KEY ("dispatchId") REFERENCES "CpcaEmailDispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CpcaEmailDelivery"
ADD CONSTRAINT "CpcaEmailDelivery_templateId_fkey"
FOREIGN KEY ("templateId") REFERENCES "CpcaEmailTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CpcaEmailDelivery"
ADD CONSTRAINT "CpcaEmailDelivery_omId_fkey"
FOREIGN KEY ("omId") REFERENCES "Om"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CpcaEmailDelivery"
ADD CONSTRAINT "CpcaEmailDelivery_presidentUserId_fkey"
FOREIGN KEY ("presidentUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

WITH cpca_email_permissions(resource, action, scope) AS (
  VALUES
    ('cpca_emails', 'view', 'NATIONAL'),
    ('cpca_emails', 'create', 'NATIONAL'),
    ('cpca_emails', 'update', 'NATIONAL'),
    ('cpca_emails', 'delete', 'NATIONAL'),
    ('cpca_emails', 'send', 'NATIONAL')
)
INSERT INTO "Permission" ("id", "resource", "action", "scope", "description", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  p.resource,
  p.action,
  p.scope::"PermissionScope",
  p.action || ' on ' || p.resource || ' (' || p.scope || ')',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM cpca_email_permissions p
WHERE NOT EXISTS (
  SELECT 1
  FROM "Permission" existing
  WHERE existing."resource" = p.resource
    AND existing."action" = p.action
    AND existing."scope" = p.scope::"PermissionScope"
);

WITH matrix(role_name, resource, action, scope) AS (
  VALUES
    ('COMGEP', 'cpca_emails', 'view', 'NATIONAL'),
    ('COMGEP', 'cpca_emails', 'create', 'NATIONAL'),
    ('COMGEP', 'cpca_emails', 'update', 'NATIONAL'),
    ('COMGEP', 'cpca_emails', 'delete', 'NATIONAL'),
    ('COMGEP', 'cpca_emails', 'send', 'NATIONAL'),
    ('TI', 'cpca_emails', 'view', 'NATIONAL'),
    ('TI', 'cpca_emails', 'create', 'NATIONAL'),
    ('TI', 'cpca_emails', 'update', 'NATIONAL'),
    ('TI', 'cpca_emails', 'delete', 'NATIONAL'),
    ('TI', 'cpca_emails', 'send', 'NATIONAL')
)
INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT
  gen_random_uuid()::text,
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
