ALTER TABLE "TaskTemplate"
ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "TaskTemplate_deletedAt_idx" ON "TaskTemplate"("deletedAt");
