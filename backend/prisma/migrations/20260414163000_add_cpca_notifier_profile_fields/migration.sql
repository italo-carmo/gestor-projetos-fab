ALTER TABLE "CpcComplaintCase"
  ADD COLUMN IF NOT EXISTS "victimIsNotifier" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "notifierRank" TEXT,
  ADD COLUMN IF NOT EXISTS "notifierGender" "CpcGender",
  ADD COLUMN IF NOT EXISTS "notifierAgeRange" TEXT;

UPDATE "CpcComplaintCase"
SET
  "notifierRank" = COALESCE(NULLIF("victimRank", ''), 'NAO INFORMADO'),
  "notifierGender" = COALESCE("victimGender", 'NAO_INFORMADO'::"CpcGender"),
  "notifierAgeRange" = "victimAgeRange",
  "victimIsNotifier" = true
WHERE "notifierRank" IS NULL
   OR "notifierGender" IS NULL;

ALTER TABLE "CpcComplaintCase"
  ALTER COLUMN "notifierRank" SET NOT NULL,
  ALTER COLUMN "notifierRank" SET DEFAULT 'NAO INFORMADO',
  ALTER COLUMN "notifierGender" SET NOT NULL,
  ALTER COLUMN "notifierGender" SET DEFAULT 'NAO_INFORMADO';
