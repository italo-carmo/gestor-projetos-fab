CREATE TYPE "CertificateQuestionType" AS ENUM ('TEXT', 'MULTIPLE_CHOICE', 'CHECKBOXES');

CREATE TYPE "CertificateEmailDeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

CREATE TABLE "CertificateTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "layoutJson" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificateTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CertificateEvent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "eventDate" TEXT NOT NULL,
    "eventTime" TEXT NOT NULL,
    "description" TEXT,
    "publicSlug" TEXT NOT NULL,
    "formTitle" TEXT,
    "formDescription" TEXT,
    "formIsPublished" BOOLEAN NOT NULL DEFAULT false,
    "certificateTemplateId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificateEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CertificateFormQuestion" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "CertificateQuestionType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "optionsJson" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificateFormQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CertificateFormResponse" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "answersJson" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificateFormResponse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CertificateEmailDelivery" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "templateId" TEXT,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "status" "CertificateEmailDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificateEmailDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CertificateEvent_publicSlug_key" ON "CertificateEvent"("publicSlug");
CREATE INDEX "CertificateTemplate_isActive_updatedAt_idx" ON "CertificateTemplate"("isActive", "updatedAt");
CREATE INDEX "CertificateTemplate_createdById_idx" ON "CertificateTemplate"("createdById");
CREATE INDEX "CertificateEvent_eventDate_eventTime_idx" ON "CertificateEvent"("eventDate", "eventTime");
CREATE INDEX "CertificateEvent_certificateTemplateId_idx" ON "CertificateEvent"("certificateTemplateId");
CREATE INDEX "CertificateEvent_createdById_idx" ON "CertificateEvent"("createdById");
CREATE INDEX "CertificateFormQuestion_eventId_sortOrder_idx" ON "CertificateFormQuestion"("eventId", "sortOrder");
CREATE INDEX "CertificateFormResponse_eventId_submittedAt_idx" ON "CertificateFormResponse"("eventId", "submittedAt");
CREATE INDEX "CertificateFormResponse_email_idx" ON "CertificateFormResponse"("email");
CREATE INDEX "CertificateEmailDelivery_eventId_status_createdAt_idx" ON "CertificateEmailDelivery"("eventId", "status", "createdAt");
CREATE INDEX "CertificateEmailDelivery_responseId_createdAt_idx" ON "CertificateEmailDelivery"("responseId", "createdAt");

ALTER TABLE "CertificateTemplate"
ADD CONSTRAINT "CertificateTemplate_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CertificateEvent"
ADD CONSTRAINT "CertificateEvent_certificateTemplateId_fkey"
FOREIGN KEY ("certificateTemplateId") REFERENCES "CertificateTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CertificateEvent"
ADD CONSTRAINT "CertificateEvent_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CertificateFormQuestion"
ADD CONSTRAINT "CertificateFormQuestion_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "CertificateEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CertificateFormResponse"
ADD CONSTRAINT "CertificateFormResponse_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "CertificateEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CertificateEmailDelivery"
ADD CONSTRAINT "CertificateEmailDelivery_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "CertificateEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CertificateEmailDelivery"
ADD CONSTRAINT "CertificateEmailDelivery_responseId_fkey"
FOREIGN KEY ("responseId") REFERENCES "CertificateFormResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CertificateEmailDelivery"
ADD CONSTRAINT "CertificateEmailDelivery_templateId_fkey"
FOREIGN KEY ("templateId") REFERENCES "CertificateTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

WITH certificate_permissions(resource, action, scope) AS (
  VALUES
    ('certificate_events', 'view', 'NATIONAL'),
    ('certificate_events', 'create', 'NATIONAL'),
    ('certificate_events', 'update', 'NATIONAL'),
    ('certificate_events', 'delete', 'NATIONAL'),
    ('certificate_events', 'send', 'NATIONAL'),
    ('certificate_templates', 'view', 'NATIONAL'),
    ('certificate_templates', 'create', 'NATIONAL'),
    ('certificate_templates', 'update', 'NATIONAL'),
    ('certificate_templates', 'delete', 'NATIONAL')
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
FROM certificate_permissions p
WHERE NOT EXISTS (
  SELECT 1
  FROM "Permission" existing
  WHERE existing."resource" = p.resource
    AND existing."action" = p.action
    AND existing."scope" = p.scope::"PermissionScope"
);

WITH matrix(role_name, resource, action, scope) AS (
  VALUES
    ('COMGEP', 'certificate_events', 'view', 'NATIONAL'),
    ('COMGEP', 'certificate_events', 'create', 'NATIONAL'),
    ('COMGEP', 'certificate_events', 'update', 'NATIONAL'),
    ('COMGEP', 'certificate_events', 'delete', 'NATIONAL'),
    ('COMGEP', 'certificate_events', 'send', 'NATIONAL'),
    ('COMGEP', 'certificate_templates', 'view', 'NATIONAL'),
    ('COMGEP', 'certificate_templates', 'create', 'NATIONAL'),
    ('COMGEP', 'certificate_templates', 'update', 'NATIONAL'),
    ('COMGEP', 'certificate_templates', 'delete', 'NATIONAL'),
    ('TI', 'certificate_events', 'view', 'NATIONAL'),
    ('TI', 'certificate_events', 'create', 'NATIONAL'),
    ('TI', 'certificate_events', 'update', 'NATIONAL'),
    ('TI', 'certificate_events', 'delete', 'NATIONAL'),
    ('TI', 'certificate_events', 'send', 'NATIONAL'),
    ('TI', 'certificate_templates', 'view', 'NATIONAL'),
    ('TI', 'certificate_templates', 'create', 'NATIONAL'),
    ('TI', 'certificate_templates', 'update', 'NATIONAL'),
    ('TI', 'certificate_templates', 'delete', 'NATIONAL')
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
