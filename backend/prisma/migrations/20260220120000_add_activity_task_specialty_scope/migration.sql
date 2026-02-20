-- Add optional specialty linkage to activities and task instances.
ALTER TABLE "Activity"
ADD COLUMN "specialtyId" TEXT;

ALTER TABLE "TaskInstance"
ADD COLUMN "specialtyId" TEXT;

-- Backfill task specialty from template to preserve current behavior.
UPDATE "TaskInstance" AS ti
SET "specialtyId" = tt."specialtyId"
FROM "TaskTemplate" AS tt
WHERE ti."taskTemplateId" = tt."id"
  AND ti."specialtyId" IS NULL;

-- Indexes for scope filters.
CREATE INDEX "Activity_specialtyId_idx" ON "Activity"("specialtyId");
CREATE INDEX "TaskInstance_specialtyId_idx" ON "TaskInstance"("specialtyId");

-- Foreign keys.
ALTER TABLE "Activity"
ADD CONSTRAINT "Activity_specialtyId_fkey"
FOREIGN KEY ("specialtyId") REFERENCES "Specialty"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TaskInstance"
ADD CONSTRAINT "TaskInstance_specialtyId_fkey"
FOREIGN KEY ("specialtyId") REFERENCES "Specialty"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
