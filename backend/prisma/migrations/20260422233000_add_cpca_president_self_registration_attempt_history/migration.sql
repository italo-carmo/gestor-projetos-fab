ALTER TABLE "CpcaPresidentSelfRegistration"
ADD COLUMN "retryRootRequestId" TEXT,
ADD COLUMN "previousAttemptId" TEXT,
ADD COLUMN "attemptNumber" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "CpcaPresidentSelfRegistration"
ADD CONSTRAINT "CpcaPresidentSelfRegistration_retryRootRequestId_fkey"
FOREIGN KEY ("retryRootRequestId") REFERENCES "CpcaPresidentSelfRegistration"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CpcaPresidentSelfRegistration"
ADD CONSTRAINT "CpcaPresidentSelfRegistration_previousAttemptId_fkey"
FOREIGN KEY ("previousAttemptId") REFERENCES "CpcaPresidentSelfRegistration"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "CpcaPresidentSelfRegistration_retryRootRequestId_createdAt_idx"
ON "CpcaPresidentSelfRegistration"("retryRootRequestId", "createdAt");

CREATE INDEX "CpcaPresidentSelfRegistration_previousAttemptId_idx"
ON "CpcaPresidentSelfRegistration"("previousAttemptId");
