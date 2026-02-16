-- Activities (external actions) and structured signed reports
CREATE TYPE "ActivityStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'DONE', 'CANCELLED');

CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "localityId" TEXT,
    "eventDate" TIMESTAMP(3),
    "status" "ActivityStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "reportRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActivityReport" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "responsible" TEXT NOT NULL,
    "missionSupport" TEXT NOT NULL,
    "introduction" TEXT NOT NULL,
    "missionObjectives" TEXT NOT NULL,
    "executionSchedule" TEXT NOT NULL,
    "activitiesPerformed" TEXT NOT NULL,
    "participantsCount" INTEGER NOT NULL,
    "participantsCharacteristics" TEXT NOT NULL,
    "conclusion" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "closingDate" TIMESTAMP(3) NOT NULL,
    "signaturePayloadHash" TEXT,
    "signatureHash" TEXT,
    "signatureAlgorithm" TEXT,
    "signatureVersion" INTEGER,
    "signedAt" TIMESTAMP(3),
    "signedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ActivityReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActivityReportPhoto" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "storageKey" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityReportPhoto_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActivityReport_activityId_key" ON "ActivityReport"("activityId");
CREATE INDEX "Activity_localityId_idx" ON "Activity"("localityId");
CREATE INDEX "Activity_status_idx" ON "Activity"("status");
CREATE INDEX "Activity_eventDate_idx" ON "Activity"("eventDate");
CREATE INDEX "ActivityReportPhoto_reportId_idx" ON "ActivityReportPhoto"("reportId");

ALTER TABLE "Activity" ADD CONSTRAINT "Activity_localityId_fkey"
FOREIGN KEY ("localityId") REFERENCES "Locality"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Activity" ADD CONSTRAINT "Activity_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ActivityReport" ADD CONSTRAINT "ActivityReport_activityId_fkey"
FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActivityReport" ADD CONSTRAINT "ActivityReport_signedById_fkey"
FOREIGN KEY ("signedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ActivityReportPhoto" ADD CONSTRAINT "ActivityReportPhoto_reportId_fkey"
FOREIGN KEY ("reportId") REFERENCES "ActivityReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
