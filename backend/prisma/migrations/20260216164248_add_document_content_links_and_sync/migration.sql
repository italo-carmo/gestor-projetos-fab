-- CreateEnum
CREATE TYPE "DocumentParseStatus" AS ENUM ('PENDING', 'EXTRACTED', 'PARTIAL', 'FAILED', 'NOT_SUPPORTED');

-- CreateEnum
CREATE TYPE "DocumentLinkEntity" AS ENUM ('TASK_INSTANCE', 'TASK_TEMPLATE', 'ACTIVITY', 'MEETING', 'ELO', 'LOCALITY');

-- CreateTable
CREATE TABLE "DocumentContent" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "parseStatus" "DocumentParseStatus" NOT NULL DEFAULT 'PENDING',
    "textContent" TEXT,
    "parsedAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentLink" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "entityType" "DocumentLinkEntity" NOT NULL,
    "entityId" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentContent_documentId_key" ON "DocumentContent"("documentId");

-- CreateIndex
CREATE INDEX "DocumentContent_parseStatus_parsedAt_idx" ON "DocumentContent"("parseStatus", "parsedAt");

-- CreateIndex
CREATE INDEX "DocumentLink_documentId_entityType_idx" ON "DocumentLink"("documentId", "entityType");

-- CreateIndex
CREATE INDEX "DocumentLink_entityType_entityId_idx" ON "DocumentLink"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentLink_documentId_entityType_entityId_key" ON "DocumentLink"("documentId", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "DocumentContent" ADD CONSTRAINT "DocumentContent_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DocumentAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentLink" ADD CONSTRAINT "DocumentLink_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DocumentAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
