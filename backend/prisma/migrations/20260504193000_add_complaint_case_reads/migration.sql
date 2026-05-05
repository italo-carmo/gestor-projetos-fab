CREATE TABLE IF NOT EXISTS "CpcComplaintCaseRead" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "complaintCaseId" TEXT NOT NULL,
  "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CpcComplaintCaseRead_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CpcComplaintCaseRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CpcComplaintCaseRead_complaintCaseId_fkey" FOREIGN KEY ("complaintCaseId") REFERENCES "CpcComplaintCase"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CpcComplaintCaseRead_userId_complaintCaseId_key"
  ON "CpcComplaintCaseRead"("userId", "complaintCaseId");

CREATE INDEX IF NOT EXISTS "CpcComplaintCaseRead_userId_seenAt_idx"
  ON "CpcComplaintCaseRead"("userId", "seenAt");

CREATE INDEX IF NOT EXISTS "CpcComplaintCaseRead_complaintCaseId_seenAt_idx"
  ON "CpcComplaintCaseRead"("complaintCaseId", "seenAt");
