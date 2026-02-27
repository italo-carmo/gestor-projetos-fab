ALTER TABLE "CpcComplaintCase"
  ADD COLUMN IF NOT EXISTS "aggressorAgeRange" TEXT,
  ADD COLUMN IF NOT EXISTS "victimAgeRange" TEXT,
  ADD COLUMN IF NOT EXISTS "detailedViolenceType" TEXT,
  ADD COLUMN IF NOT EXISTS "harassmentContext" TEXT,
  ADD COLUMN IF NOT EXISTS "occurrenceLocation" TEXT,
  ADD COLUMN IF NOT EXISTS "incidentFrequency" TEXT,
  ADD COLUMN IF NOT EXISTS "hierarchicalFunctionalRelation" TEXT,
  ADD COLUMN IF NOT EXISTS "occurrenceForm" TEXT,
  ADD COLUMN IF NOT EXISTS "administrativeProcedure" TEXT,
  ADD COLUMN IF NOT EXISTS "procedureCurrentSituation" TEXT,
  ADD COLUMN IF NOT EXISTS "retaliationReported" TEXT,
  ADD COLUMN IF NOT EXISTS "retaliationAgainst" TEXT;
