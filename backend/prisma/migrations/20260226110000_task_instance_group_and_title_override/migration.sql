ALTER TABLE "TaskInstance"
ADD COLUMN "groupKey" TEXT,
ADD COLUMN "titleOverride" TEXT;

CREATE INDEX "TaskInstance_groupKey_idx" ON "TaskInstance"("groupKey");
