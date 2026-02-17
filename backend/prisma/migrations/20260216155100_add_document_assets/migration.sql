-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('GENERAL', 'MISSION', 'PRESENTATION', 'HISTORY', 'RESEARCH', 'SMIF', 'VISUAL_IDENTITY');

-- CreateTable
CREATE TABLE "DocumentAsset" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "sourcePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "storageKey" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "checksum" TEXT,
    "localityId" TEXT,
    "activityId" TEXT,
    "meetingId" TEXT,
    "tagsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentAsset_category_localityId_createdAt_idx" ON "DocumentAsset"("category", "localityId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentAsset_activityId_idx" ON "DocumentAsset"("activityId");

-- CreateIndex
CREATE INDEX "DocumentAsset_meetingId_idx" ON "DocumentAsset"("meetingId");

-- AddForeignKey
ALTER TABLE "DocumentAsset" ADD CONSTRAINT "DocumentAsset_localityId_fkey" FOREIGN KEY ("localityId") REFERENCES "Locality"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAsset" ADD CONSTRAINT "DocumentAsset_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAsset" ADD CONSTRAINT "DocumentAsset_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
