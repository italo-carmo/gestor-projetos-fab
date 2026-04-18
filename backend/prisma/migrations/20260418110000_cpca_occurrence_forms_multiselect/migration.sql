ALTER TABLE "CpcComplaintCase"
  ADD COLUMN IF NOT EXISTS "occurrenceForms" TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE "CpcComplaintCase"
SET "occurrenceForms" = ARRAY[trim("occurrenceForm")]::TEXT[]
WHERE COALESCE(array_length("occurrenceForms", 1), 0) = 0
  AND "occurrenceForm" IS NOT NULL
  AND trim("occurrenceForm") <> '';

ALTER TABLE "CpcComplaintCase"
  ALTER COLUMN "occurrenceForms" SET DEFAULT ARRAY[]::TEXT[];
