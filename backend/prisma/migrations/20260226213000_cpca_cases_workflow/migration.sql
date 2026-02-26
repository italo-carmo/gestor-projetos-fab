DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CpcComplaintType') THEN
    CREATE TYPE "CpcComplaintType" AS ENUM ('MORAL', 'SEXUAL');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CpcNotifierType') THEN
    CREATE TYPE "CpcNotifierType" AS ENUM ('VITIMA', 'TESTEMUNHA', 'TERCEIRO');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CpcComplaintStatus') THEN
    CREATE TYPE "CpcComplaintStatus" AS ENUM (
      'RECEIVED',
      'PROTECTION_MEASURES',
      'PRELIMINARY_ANALYSIS',
      'PROCEDURE_DEFINED',
      'INVESTIGATION',
      'CONCLUDED',
      'ARCHIVED'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CpcProcedureType') THEN
    CREATE TYPE "CpcProcedureType" AS ENUM ('NOT_DEFINED', 'PATD', 'SINDICANCIA', 'PAD', 'IPM');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CpcGender') THEN
    CREATE TYPE "CpcGender" AS ENUM ('MASCULINO', 'FEMININO', 'NAO_INFORMADO');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "CpcComplaintCase" (
  "id" TEXT NOT NULL,
  "caseNumber" TEXT NOT NULL,
  "localityId" TEXT NOT NULL,
  "complaintType" "CpcComplaintType" NOT NULL,
  "notifierType" "CpcNotifierType" NOT NULL DEFAULT 'VITIMA',
  "status" "CpcComplaintStatus" NOT NULL DEFAULT 'RECEIVED',
  "procedureType" "CpcProcedureType" NOT NULL DEFAULT 'NOT_DEFINED',
  "incidentDate" TIMESTAMP(3),
  "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "aggressorRank" TEXT NOT NULL,
  "aggressorGender" "CpcGender" NOT NULL,
  "victimRank" TEXT NOT NULL,
  "victimGender" "CpcGender" NOT NULL,
  "evidenceCount" INTEGER NOT NULL DEFAULT 0,
  "evidenceSummary" TEXT,
  "confidentialityTermSigned" BOOLEAN NOT NULL DEFAULT false,
  "confidentialityHandlingNotes" TEXT,
  "cpcaMembersExcludedFromInquiry" BOOLEAN NOT NULL DEFAULT true,
  "immediateProtectionMeasures" TEXT,
  "privateSupportActions" TEXT,
  "psychologicalSupportProvided" BOOLEAN NOT NULL DEFAULT false,
  "medicalSupportProvided" BOOLEAN NOT NULL DEFAULT false,
  "socialSupportProvided" BOOLEAN NOT NULL DEFAULT false,
  "legalSupportProvided" BOOLEAN NOT NULL DEFAULT false,
  "contactRestrictionApplied" BOOLEAN NOT NULL DEFAULT false,
  "preliminaryAnalysis" TEXT,
  "preliminaryReportGenerated" BOOLEAN NOT NULL DEFAULT false,
  "preliminaryReportDate" TIMESTAMP(3),
  "procedureReference" TEXT,
  "procedureNotes" TEXT,
  "womenLedHandlingPrioritized" BOOLEAN,
  "victimAccusedSeparationEvaluated" BOOLEAN NOT NULL DEFAULT false,
  "victimAccusedSeparationApplied" BOOLEAN NOT NULL DEFAULT false,
  "accusedDefenseEnsured" BOOLEAN NOT NULL DEFAULT false,
  "outcomeSummary" TEXT,
  "notifierFeedbackSummary" TEXT,
  "victimFeedbackSummary" TEXT,
  "notifierFeedbackDate" TIMESTAMP(3),
  "victimFeedbackDate" TIMESTAMP(3),
  "retaliationRisk" BOOLEAN NOT NULL DEFAULT false,
  "retaliationNotes" TEXT,
  "outsourcedAccused" BOOLEAN NOT NULL DEFAULT false,
  "contractorReferralDate" TIMESTAMP(3),
  "contractorFollowUpNotes" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CpcComplaintCase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CpcComplaintCase_localityId_fkey" FOREIGN KEY ("localityId") REFERENCES "Locality"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CpcComplaintCase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CpcComplaintCase_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CpcComplaintCase_caseNumber_key" ON "CpcComplaintCase"("caseNumber");
CREATE INDEX IF NOT EXISTS "CpcComplaintCase_localityId_status_idx" ON "CpcComplaintCase"("localityId", "status");
CREATE INDEX IF NOT EXISTS "CpcComplaintCase_complaintType_status_idx" ON "CpcComplaintCase"("complaintType", "status");
CREATE INDEX IF NOT EXISTS "CpcComplaintCase_procedureType_idx" ON "CpcComplaintCase"("procedureType");
CREATE INDEX IF NOT EXISTS "CpcComplaintCase_reportedAt_idx" ON "CpcComplaintCase"("reportedAt");

CREATE TABLE IF NOT EXISTS "CpcComplaintComment" (
  "id" TEXT NOT NULL,
  "complaintCaseId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CpcComplaintComment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CpcComplaintComment_complaintCaseId_fkey" FOREIGN KEY ("complaintCaseId") REFERENCES "CpcComplaintCase"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CpcComplaintComment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CpcComplaintComment_complaintCaseId_createdAt_idx" ON "CpcComplaintComment"("complaintCaseId", "createdAt");

CREATE TABLE IF NOT EXISTS "CpcComplaintStatusHistory" (
  "id" TEXT NOT NULL,
  "complaintCaseId" TEXT NOT NULL,
  "fromStatus" "CpcComplaintStatus",
  "toStatus" "CpcComplaintStatus" NOT NULL,
  "fromProcedure" "CpcProcedureType",
  "toProcedure" "CpcProcedureType" NOT NULL,
  "note" TEXT,
  "changedById" TEXT NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CpcComplaintStatusHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CpcComplaintStatusHistory_complaintCaseId_fkey" FOREIGN KEY ("complaintCaseId") REFERENCES "CpcComplaintCase"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CpcComplaintStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CpcComplaintStatusHistory_complaintCaseId_changedAt_idx" ON "CpcComplaintStatusHistory"("complaintCaseId", "changedAt");

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
    ('cpca_cases', 'view', 'LOCALITY'),
    ('cpca_cases', 'create', 'LOCALITY'),
    ('cpca_cases', 'update', 'LOCALITY'),
    ('cpca_cases', 'comment', 'LOCALITY'),
    ('cpca_cases', 'view', 'NATIONAL'),
    ('cpca_cases', 'create', 'NATIONAL'),
    ('cpca_cases', 'update', 'NATIONAL'),
    ('cpca_cases', 'comment', 'NATIONAL')
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
  "constraintsTemplateJson",
  "createdAt",
  "updatedAt"
)
VALUES (
  concat('role_', gen_random_uuid()::text),
  'CPCA',
  'Comissão de Prevenção e Combate ao Assédio: registro e acompanhamento sigiloso por OM',
  true,
  false,
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
    ('CPCA', 'cpca_cases', 'view', 'LOCALITY'),
    ('CPCA', 'cpca_cases', 'create', 'LOCALITY'),
    ('CPCA', 'cpca_cases', 'update', 'LOCALITY'),
    ('CPCA', 'cpca_cases', 'comment', 'LOCALITY'),

    ('Coordenação CIPAVD', 'cpca_cases', 'view', 'NATIONAL'),
    ('Coordenação CIPAVD', 'cpca_cases', 'create', 'NATIONAL'),
    ('Coordenação CIPAVD', 'cpca_cases', 'update', 'NATIONAL'),
    ('Coordenação CIPAVD', 'cpca_cases', 'comment', 'NATIONAL'),

    ('COMGEP', 'cpca_cases', 'view', 'NATIONAL'),
    ('COMGEP', 'cpca_cases', 'create', 'NATIONAL'),
    ('COMGEP', 'cpca_cases', 'update', 'NATIONAL'),
    ('COMGEP', 'cpca_cases', 'comment', 'NATIONAL'),

    ('Comandante COMGEP', 'cpca_cases', 'view', 'NATIONAL'),
    ('Comandante COMGEP', 'cpca_cases', 'create', 'NATIONAL'),
    ('Comandante COMGEP', 'cpca_cases', 'update', 'NATIONAL'),
    ('Comandante COMGEP', 'cpca_cases', 'comment', 'NATIONAL')
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
