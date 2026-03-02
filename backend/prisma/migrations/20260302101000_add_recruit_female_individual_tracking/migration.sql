-- Individual tracking for female recruits per GSD/OM
CREATE TYPE "RecruitFemaleStatus" AS ENUM (
  'RECRUITMENT_TO_START',
  'RECRUITMENT_STARTED',
  'DISMISSED',
  'ASSIGNED_TO_OM'
);

CREATE TABLE "RecruitFemale" (
  "id" TEXT NOT NULL,
  "localityId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "RecruitFemaleStatus" NOT NULL DEFAULT 'RECRUITMENT_TO_START',
  "dismissalReason" TEXT,
  "dismissedAt" TIMESTAMP(3),
  "destinationLocalityId" TEXT,
  "designatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecruitFemale_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecruitFemale_localityId_status_idx" ON "RecruitFemale"("localityId", "status");
CREATE INDEX "RecruitFemale_destinationLocalityId_status_idx" ON "RecruitFemale"("destinationLocalityId", "status");
CREATE INDEX "RecruitFemale_status_dismissedAt_idx" ON "RecruitFemale"("status", "dismissedAt");

ALTER TABLE "RecruitFemale"
  ADD CONSTRAINT "RecruitFemale_localityId_fkey"
  FOREIGN KEY ("localityId") REFERENCES "Locality"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecruitFemale"
  ADD CONSTRAINT "RecruitFemale_destinationLocalityId_fkey"
  FOREIGN KEY ("destinationLocalityId") REFERENCES "Locality"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Transition seed: create one fictitious recruit per current count in each GSD
INSERT INTO "RecruitFemale" (
  "id",
  "localityId",
  "name",
  "status",
  "createdAt",
  "updatedAt"
)
SELECT
  'rf_' || replace(gen_random_uuid()::text, '-', ''),
  l."id",
  'Recruta ' || gs.n::text || ' - ' || COALESCE(NULLIF(l."code", ''), left(l."name", 8)),
  'RECRUITMENT_TO_START'::"RecruitFemaleStatus",
  now(),
  now()
FROM "Locality" l
JOIN LATERAL generate_series(1, GREATEST(COALESCE(l."recruitsFemaleCountCurrent", 0), 0)) AS gs(n)
  ON true;
