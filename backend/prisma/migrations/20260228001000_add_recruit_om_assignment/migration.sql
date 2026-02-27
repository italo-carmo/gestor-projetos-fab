CREATE TABLE IF NOT EXISTS "RecruitOmAssignment" (
  "id" TEXT NOT NULL,
  "sourceLocalityId" TEXT NOT NULL,
  "destinationLocalityId" TEXT NOT NULL,
  "assignedCount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RecruitOmAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RecruitOmAssignment_sourceLocalityId_fkey" FOREIGN KEY ("sourceLocalityId") REFERENCES "Locality"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RecruitOmAssignment_destinationLocalityId_fkey" FOREIGN KEY ("destinationLocalityId") REFERENCES "Locality"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "RecruitOmAssignment_sourceLocalityId_destinationLocalityId_key"
ON "RecruitOmAssignment"("sourceLocalityId", "destinationLocalityId");

CREATE INDEX IF NOT EXISTS "RecruitOmAssignment_sourceLocalityId_idx"
ON "RecruitOmAssignment"("sourceLocalityId");

CREATE INDEX IF NOT EXISTS "RecruitOmAssignment_destinationLocalityId_idx"
ON "RecruitOmAssignment"("destinationLocalityId");
