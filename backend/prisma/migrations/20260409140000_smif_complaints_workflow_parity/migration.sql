DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'CpcComplaintWorkflowScope'
  ) THEN
    CREATE TYPE "CpcComplaintWorkflowScope" AS ENUM ('CPCA', 'SMIF');
  END IF;
END $$;

ALTER TABLE "CpcComplaintCase"
  ADD COLUMN IF NOT EXISTS "workflowScope" "CpcComplaintWorkflowScope" NOT NULL DEFAULT 'CPCA',
  ADD COLUMN IF NOT EXISTS "legacySmifComplaintId" TEXT;

UPDATE "CpcComplaintCase"
SET "workflowScope" = 'CPCA'
WHERE "workflowScope" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "CpcComplaintCase_legacySmifComplaintId_key"
  ON "CpcComplaintCase"("legacySmifComplaintId");

CREATE INDEX IF NOT EXISTS "CpcComplaintCase_workflowScope_localityId_status_idx"
  ON "CpcComplaintCase"("workflowScope", "localityId", "status");

CREATE INDEX IF NOT EXISTS "CpcComplaintCase_workflowScope_reportedAt_idx"
  ON "CpcComplaintCase"("workflowScope", "reportedAt");

WITH smif_permissions(resource, action, scope) AS (
  VALUES
    ('smif_complaints', 'view', 'LOCALITY'),
    ('smif_complaints', 'create', 'LOCALITY'),
    ('smif_complaints', 'update', 'LOCALITY'),
    ('smif_complaints', 'comment', 'LOCALITY'),
    ('smif_complaints', 'delete', 'LOCALITY'),
    ('smif_complaints', 'view', 'NATIONAL'),
    ('smif_complaints', 'create', 'NATIONAL'),
    ('smif_complaints', 'update', 'NATIONAL'),
    ('smif_complaints', 'comment', 'NATIONAL'),
    ('smif_complaints', 'delete', 'NATIONAL')
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
  concat(p.action, ' on ', p.resource, ' (', p.scope, ')'),
  now(),
  now()
FROM smif_permissions p
WHERE NOT EXISTS (
  SELECT 1
  FROM "Permission" x
  WHERE x."resource" = p.resource
    AND x."action" = p.action
    AND x."scope" = p.scope::"PermissionScope"
);

WITH role_permission_targets(role_name, resource, action, scope) AS (
  VALUES
    ('TI', 'smif_complaints', 'view', 'NATIONAL'),
    ('TI', 'smif_complaints', 'create', 'NATIONAL'),
    ('TI', 'smif_complaints', 'update', 'NATIONAL'),
    ('TI', 'smif_complaints', 'comment', 'NATIONAL'),
    ('TI', 'smif_complaints', 'delete', 'NATIONAL'),
    ('Coordenação CIPAVD', 'smif_complaints', 'view', 'NATIONAL'),
    ('Coordenação CIPAVD', 'smif_complaints', 'create', 'NATIONAL'),
    ('Coordenação CIPAVD', 'smif_complaints', 'update', 'NATIONAL'),
    ('Coordenação CIPAVD', 'smif_complaints', 'comment', 'NATIONAL'),
    ('Coordenação CIPAVD', 'smif_complaints', 'delete', 'NATIONAL'),
    ('Coordenacao CIPAVD', 'smif_complaints', 'view', 'NATIONAL'),
    ('Coordenacao CIPAVD', 'smif_complaints', 'create', 'NATIONAL'),
    ('Coordenacao CIPAVD', 'smif_complaints', 'update', 'NATIONAL'),
    ('Coordenacao CIPAVD', 'smif_complaints', 'comment', 'NATIONAL'),
    ('Coordenacao CIPAVD', 'smif_complaints', 'delete', 'NATIONAL'),
    ('COMGEP', 'smif_complaints', 'view', 'NATIONAL'),
    ('Comandante COMGEP', 'smif_complaints', 'view', 'NATIONAL')
)
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM role_permission_targets t
JOIN "Role" r
  ON r."name" = t.role_name
JOIN "Permission" p
  ON p."resource" = t.resource
 AND p."action" = t.action
 AND p."scope" = t.scope::"PermissionScope"
WHERE NOT EXISTS (
  SELECT 1
  FROM "RolePermission" rp
  WHERE rp."roleId" = r.id
    AND rp."permissionId" = p.id
);

DELETE FROM "RolePermission" rp
USING "Role" r, "Permission" p
WHERE rp."roleId" = r.id
  AND rp."permissionId" = p.id
  AND p."resource" = 'smif_complaints'
  AND p."action" IN ('create', 'update', 'comment', 'delete')
  AND r."name" NOT IN ('TI', 'Coordenação CIPAVD', 'Coordenacao CIPAVD');

DELETE FROM "RolePermission" rp
USING "Role" r, "Permission" p
WHERE rp."roleId" = r.id
  AND rp."permissionId" = p.id
  AND p."resource" = 'smif_complaints'
  AND p."action" = 'view'
  AND r."name" NOT IN (
    'TI',
    'Coordenação CIPAVD',
    'Coordenacao CIPAVD',
    'COMGEP',
    'Comandante COMGEP'
  );

WITH source_rows AS (
  SELECT
    s."id" AS "legacyId",
    s."localityId",
    s."reportedAt",
    s."description",
    s."status" AS "legacyStatus",
    s."conclusion",
    s."createdById",
    s."updatedById",
    s."createdAt",
    s."updatedAt",
    date_part('year', s."reportedAt")::INT AS "reportYear",
    COALESCE(
      NULLIF(regexp_replace(upper(COALESCE(l."code", '')), '[^A-Z0-9]', '', 'g'), ''),
      'OM'
    ) AS "localityToken"
  FROM "SmifComplaint" s
  JOIN "Locality" l
    ON l."id" = s."localityId"
  WHERE NOT EXISTS (
    SELECT 1
    FROM "CpcComplaintCase" c
    WHERE c."legacySmifComplaintId" = s."id"
  )
),
source_with_prefix AS (
  SELECT
    src.*,
    concat('SMIF-', src."reportYear", '-', left(src."localityToken", 6), '-') AS "casePrefix"
  FROM source_rows src
),
existing_smif_sequences AS (
  SELECT
    regexp_replace(c."caseNumber", '(\\d{5})$', '') AS "casePrefix",
    MAX(right(c."caseNumber", 5)::INT) AS "maxSeq"
  FROM "CpcComplaintCase" c
  WHERE c."caseNumber" ~ '^SMIF-[0-9]{4}-[A-Z0-9]{1,6}-[0-9]{5}$'
  GROUP BY 1
),
source_ranked AS (
  SELECT
    src.*,
    COALESCE(ex."maxSeq", 0) +
      ROW_NUMBER() OVER (
        PARTITION BY src."casePrefix"
        ORDER BY src."reportedAt", src."legacyId"
      ) AS "seq"
  FROM source_with_prefix src
  LEFT JOIN existing_smif_sequences ex
    ON ex."casePrefix" = src."casePrefix"
),
inserted_cases AS (
  INSERT INTO "CpcComplaintCase" (
    "id",
    "caseNumber",
    "workflowScope",
    "legacySmifComplaintId",
    "localityId",
    "complaintType",
    "notifierType",
    "status",
    "procedureType",
    "reportedAt",
    "aggressorRank",
    "aggressorGender",
    "victimRank",
    "victimGender",
    "preliminaryAnalysis",
    "outcomeSummary",
    "accusedDefenseEnsured",
    "archivedAt",
    "createdById",
    "updatedById",
    "createdAt",
    "updatedAt"
  )
  SELECT
    concat('cpccase_', gen_random_uuid()::text),
    concat(src."casePrefix", lpad(src."seq"::TEXT, 5, '0')),
    'SMIF'::"CpcComplaintWorkflowScope",
    src."legacyId",
    src."localityId",
    'MORAL'::"CpcComplaintType",
    'VITIMA'::"CpcNotifierType",
    CASE
      WHEN src."legacyStatus" = 'COMPLETED' THEN 'CONCLUDED'::"CpcComplaintStatus"
      ELSE 'INVESTIGATION'::"CpcComplaintStatus"
    END,
    'NOT_DEFINED'::"CpcProcedureType",
    src."reportedAt",
    'NAO INFORMADO',
    'NAO_INFORMADO'::"CpcGender",
    'NAO INFORMADO',
    'NAO_INFORMADO'::"CpcGender",
    NULLIF(btrim(src."description"), ''),
    CASE
      WHEN src."legacyStatus" = 'COMPLETED' THEN
        COALESCE(NULLIF(btrim(src."conclusion"), ''), NULLIF(btrim(src."description"), ''), 'Registro migrado do fluxo legado SMIF.')
      ELSE NULL
    END,
    CASE
      WHEN src."legacyStatus" = 'COMPLETED' THEN TRUE
      ELSE FALSE
    END,
    CASE
      WHEN src."legacyStatus" = 'COMPLETED' THEN src."updatedAt"
      ELSE NULL
    END,
    src."createdById",
    src."updatedById",
    src."createdAt",
    src."updatedAt"
  FROM source_ranked src
  RETURNING
    "id",
    "legacySmifComplaintId",
    "status",
    "procedureType",
    "createdById",
    "createdAt"
)
INSERT INTO "CpcComplaintStatusHistory" (
  "id",
  "complaintCaseId",
  "fromStatus",
  "toStatus",
  "fromProcedure",
  "toProcedure",
  "note",
  "changedById",
  "changedAt"
)
SELECT
  concat('cpch_', gen_random_uuid()::text),
  i."id",
  NULL,
  i."status",
  NULL,
  i."procedureType",
  concat('Registro migrado do modelo legado SMIF (origem: ', i."legacySmifComplaintId", ').'),
  i."createdById",
  i."createdAt"
FROM inserted_cases i;
