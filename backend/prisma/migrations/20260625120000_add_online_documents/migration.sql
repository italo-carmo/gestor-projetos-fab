CREATE TYPE "DocumentAssetType" AS ENUM ('FILE', 'ONLINE_DOC');

ALTER TABLE "DocumentAsset"
ADD COLUMN "assetType" "DocumentAssetType" NOT NULL DEFAULT 'FILE';

CREATE TABLE "DocumentOnlineContent" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "contentJson" JSONB NOT NULL,
    "plainText" TEXT,
    "pageSettingsJson" JSONB,
    "savedRevision" INTEGER NOT NULL DEFAULT 0,
    "lastSavedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentOnlineContent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentOnlineVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "title" TEXT,
    "contentJson" JSONB NOT NULL,
    "plainText" TEXT,
    "pageSettingsJson" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentOnlineVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentOnlineContent_documentId_key" ON "DocumentOnlineContent"("documentId");
CREATE INDEX "DocumentAsset_assetType_createdAt_idx" ON "DocumentAsset"("assetType", "createdAt");
CREATE INDEX "DocumentOnlineContent_updatedAt_idx" ON "DocumentOnlineContent"("updatedAt");
CREATE UNIQUE INDEX "DocumentOnlineVersion_documentId_revision_key" ON "DocumentOnlineVersion"("documentId", "revision");
CREATE INDEX "DocumentOnlineVersion_documentId_createdAt_idx" ON "DocumentOnlineVersion"("documentId", "createdAt");

ALTER TABLE "DocumentOnlineContent"
ADD CONSTRAINT "DocumentOnlineContent_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "DocumentAsset"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentOnlineVersion"
ADD CONSTRAINT "DocumentOnlineVersion_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "DocumentAsset"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
