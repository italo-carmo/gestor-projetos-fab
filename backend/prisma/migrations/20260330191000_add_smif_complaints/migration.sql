CREATE TYPE "SmifComplaintStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

CREATE TABLE "SmifComplaint" (
    "id" TEXT NOT NULL,
    "localityId" TEXT NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "SmifComplaintStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "conclusion" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmifComplaint_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SmifComplaint_status_reportedAt_idx" ON "SmifComplaint"("status", "reportedAt");
CREATE INDEX "SmifComplaint_localityId_reportedAt_idx" ON "SmifComplaint"("localityId", "reportedAt");
CREATE INDEX "SmifComplaint_createdById_idx" ON "SmifComplaint"("createdById");

ALTER TABLE "SmifComplaint"
  ADD CONSTRAINT "SmifComplaint_localityId_fkey"
  FOREIGN KEY ("localityId") REFERENCES "Locality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SmifComplaint"
  ADD CONSTRAINT "SmifComplaint_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SmifComplaint"
  ADD CONSTRAINT "SmifComplaint_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
