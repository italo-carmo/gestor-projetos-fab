CREATE TABLE "Om" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "uf" TEXT,
  "hasCpca" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Om_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Om_code_key" ON "Om"("code");
CREATE INDEX "Om_hasCpca_idx" ON "Om"("hasCpca");
CREATE INDEX "Om_uf_idx" ON "Om"("uf");

INSERT INTO "Om" ("id", "code", "name", "uf", "hasCpca", "notes", "createdAt", "updatedAt")
SELECT
  'om_' || substr(md5(random()::text || clock_timestamp()::text || l."id"), 1, 24),
  l."code",
  l."name",
  l."uf",
  l."hasCpca",
  l."notes",
  l."createdAt",
  l."updatedAt"
FROM "Locality" l
WHERE l."catalogType" = 'SMIF';

ALTER TABLE "User" ADD COLUMN "omId" TEXT;
ALTER TABLE "CpcComplaintCase" ADD COLUMN "omId" TEXT;

ALTER TABLE "CpcaCommissionPresident" DROP CONSTRAINT IF EXISTS "CpcaCommissionPresident_localityId_fkey";
ALTER TABLE "CpcaCommissionMember" DROP CONSTRAINT IF EXISTS "CpcaCommissionMember_localityId_fkey";
ALTER TABLE "CpcaPresidentSelfRegistration" DROP CONSTRAINT IF EXISTS "CpcaPresidentSelfRegistration_localityId_fkey";

ALTER TABLE "CpcaCommissionPresident" RENAME COLUMN "localityId" TO "omId";
ALTER TABLE "CpcaCommissionMember" RENAME COLUMN "localityId" TO "omId";
ALTER TABLE "CpcaPresidentSelfRegistration" RENAME COLUMN "localityId" TO "omId";

UPDATE "User" u
SET "omId" = o."id"
FROM "Locality" l
JOIN "Om" o ON o."code" = l."code"
WHERE u."localityId" = l."id";

UPDATE "CpcComplaintCase" c
SET "omId" = o."id"
FROM "Locality" l
JOIN "Om" o ON o."code" = l."code"
WHERE c."localityId" = l."id";

UPDATE "CpcaCommissionPresident" p
SET "omId" = o."id"
FROM "Locality" l
JOIN "Om" o ON o."code" = l."code"
WHERE p."omId" = l."id";

UPDATE "CpcaCommissionMember" m
SET "omId" = o."id"
FROM "Locality" l
JOIN "Om" o ON o."code" = l."code"
WHERE m."omId" = l."id";

UPDATE "CpcaPresidentSelfRegistration" r
SET "omId" = o."id"
FROM "Locality" l
JOIN "Om" o ON o."code" = l."code"
WHERE r."omId" = l."id";

ALTER TABLE "User"
  ADD CONSTRAINT "User_omId_fkey"
  FOREIGN KEY ("omId") REFERENCES "Om"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "User_omId_idx" ON "User"("omId");

ALTER TABLE "CpcComplaintCase"
  ADD CONSTRAINT "CpcComplaintCase_omId_fkey"
  FOREIGN KEY ("omId") REFERENCES "Om"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "CpcComplaintCase_omId_status_idx" ON "CpcComplaintCase"("omId", "status");
CREATE INDEX "CpcComplaintCase_workflowScope_omId_status_idx" ON "CpcComplaintCase"("workflowScope", "omId", "status");

ALTER TABLE "CpcaCommissionPresident"
  ADD CONSTRAINT "CpcaCommissionPresident_omId_fkey"
  FOREIGN KEY ("omId") REFERENCES "Om"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CpcaCommissionMember"
  ADD CONSTRAINT "CpcaCommissionMember_omId_fkey"
  FOREIGN KEY ("omId") REFERENCES "Om"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CpcaPresidentSelfRegistration"
  ADD CONSTRAINT "CpcaPresidentSelfRegistration_omId_fkey"
  FOREIGN KEY ("omId") REFERENCES "Om"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CpcaCommissionCoverageOm" (
  "id" TEXT NOT NULL,
  "managerOmId" TEXT NOT NULL,
  "managedOmId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CpcaCommissionCoverageOm_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CpcaCommissionCoverageOm_managerOmId_managedOmId_key" ON "CpcaCommissionCoverageOm"("managerOmId", "managedOmId");
CREATE INDEX "CpcaCommissionCoverageOm_managerOmId_idx" ON "CpcaCommissionCoverageOm"("managerOmId");
CREATE INDEX "CpcaCommissionCoverageOm_managedOmId_idx" ON "CpcaCommissionCoverageOm"("managedOmId");

ALTER TABLE "CpcaCommissionCoverageOm"
  ADD CONSTRAINT "CpcaCommissionCoverageOm_managerOmId_fkey"
  FOREIGN KEY ("managerOmId") REFERENCES "Om"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CpcaCommissionCoverageOm"
  ADD CONSTRAINT "CpcaCommissionCoverageOm_managedOmId_fkey"
  FOREIGN KEY ("managedOmId") REFERENCES "Om"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "CpcaCommissionCoverageOm" ("id", "managerOmId", "managedOmId", "createdAt", "updatedAt")
SELECT
  'omcov_' || substr(md5(random()::text || clock_timestamp()::text || c."id"), 1, 22),
  om_manager."id",
  om_managed."id",
  c."createdAt",
  c."updatedAt"
FROM "CpcaCommissionCoverage" c
JOIN "Locality" l_manager ON l_manager."id" = c."managerLocalityId"
JOIN "Locality" l_managed ON l_managed."id" = c."managedLocalityId"
JOIN "Om" om_manager ON om_manager."code" = l_manager."code"
JOIN "Om" om_managed ON om_managed."code" = l_managed."code"
ON CONFLICT ("managerOmId", "managedOmId") DO NOTHING;

ALTER TABLE "CpcComplaintCase" ALTER COLUMN "localityId" DROP NOT NULL;
