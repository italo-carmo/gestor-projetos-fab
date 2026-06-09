ALTER TABLE "CpcComplaintCase"
  ADD COLUMN "validationVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "validatedAt" TIMESTAMP(3),
  ADD COLUMN "validatedById" TEXT,
  ADD COLUMN "validatedByName" TEXT,
  ADD COLUMN "validatedByEmail" TEXT;

CREATE TABLE "CpcComplaintValidationLog" (
  "id" TEXT NOT NULL,
  "complaintCaseId" TEXT NOT NULL,
  "validationVersion" INTEGER NOT NULL,
  "validatedById" TEXT,
  "validatedByName" TEXT NOT NULL,
  "validatedByEmail" TEXT,
  "validatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "caseUpdatedAt" TIMESTAMP(3),

  CONSTRAINT "CpcComplaintValidationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CpcComplaintCase_workflowScope_validatedAt_idx"
  ON "CpcComplaintCase"("workflowScope", "validatedAt");

CREATE INDEX "CpcComplaintCase_validatedById_idx"
  ON "CpcComplaintCase"("validatedById");

CREATE INDEX "CpcComplaintValidationLog_complaintCaseId_validatedAt_idx"
  ON "CpcComplaintValidationLog"("complaintCaseId", "validatedAt");

CREATE INDEX "CpcComplaintValidationLog_validatedById_validatedAt_idx"
  ON "CpcComplaintValidationLog"("validatedById", "validatedAt");

ALTER TABLE "CpcComplaintCase"
  ADD CONSTRAINT "CpcComplaintCase_validatedById_fkey"
  FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CpcComplaintValidationLog"
  ADD CONSTRAINT "CpcComplaintValidationLog_complaintCaseId_fkey"
  FOREIGN KEY ("complaintCaseId") REFERENCES "CpcComplaintCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CpcComplaintValidationLog"
  ADD CONSTRAINT "CpcComplaintValidationLog_validatedById_fkey"
  FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
