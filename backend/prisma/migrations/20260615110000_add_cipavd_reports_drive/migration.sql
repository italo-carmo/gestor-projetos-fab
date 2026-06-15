CREATE TABLE "CipavdReportFolder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CipavdReportFolder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CipavdReportFile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "folderId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "checksum" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CipavdReportFile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CipavdReportFolder_parentId_name_key" ON "CipavdReportFolder"("parentId", "name");
CREATE UNIQUE INDEX "CipavdReportFolder_root_name_key" ON "CipavdReportFolder"("name") WHERE "parentId" IS NULL;
CREATE INDEX "CipavdReportFolder_parentId_name_idx" ON "CipavdReportFolder"("parentId", "name");
CREATE INDEX "CipavdReportFolder_createdAt_idx" ON "CipavdReportFolder"("createdAt");
CREATE INDEX "CipavdReportFolder_createdById_idx" ON "CipavdReportFolder"("createdById");

CREATE UNIQUE INDEX "CipavdReportFile_folderId_name_key" ON "CipavdReportFile"("folderId", "name");
CREATE UNIQUE INDEX "CipavdReportFile_root_name_key" ON "CipavdReportFile"("name") WHERE "folderId" IS NULL;
CREATE INDEX "CipavdReportFile_folderId_name_idx" ON "CipavdReportFile"("folderId", "name");
CREATE INDEX "CipavdReportFile_createdAt_idx" ON "CipavdReportFile"("createdAt");
CREATE INDEX "CipavdReportFile_createdById_idx" ON "CipavdReportFile"("createdById");

ALTER TABLE "CipavdReportFolder"
ADD CONSTRAINT "CipavdReportFolder_parentId_fkey"
FOREIGN KEY ("parentId") REFERENCES "CipavdReportFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CipavdReportFolder"
ADD CONSTRAINT "CipavdReportFolder_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CipavdReportFile"
ADD CONSTRAINT "CipavdReportFile_folderId_fkey"
FOREIGN KEY ("folderId") REFERENCES "CipavdReportFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CipavdReportFile"
ADD CONSTRAINT "CipavdReportFile_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
