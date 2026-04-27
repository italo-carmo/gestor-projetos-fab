ALTER TABLE "TaskInstance"
ADD COLUMN "scope" "ActivityScope" NOT NULL DEFAULT 'SMIF';

CREATE INDEX "TaskInstance_scope_idx" ON "TaskInstance"("scope");

CREATE INDEX "TaskInstance_scope_localityId_dueDate_status_idx"
ON "TaskInstance"("scope", "localityId", "dueDate", "status");
