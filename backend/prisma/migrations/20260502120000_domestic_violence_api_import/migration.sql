ALTER TYPE "BiImportFormat" ADD VALUE IF NOT EXISTS 'API';

ALTER TABLE "BiDomesticViolenceImportBatch"
ADD COLUMN "apiSinceId" INTEGER,
ADD COLUMN "apiNextSinceId" INTEGER,
ADD COLUMN "apiLastIdAvailable" INTEGER,
ADD COLUMN "apiHasMore" BOOLEAN,
ADD COLUMN "apiUpdatedAt" TIMESTAMP(3);

ALTER TABLE "BiDomesticViolenceResponse"
ADD COLUMN "apiId" INTEGER;

CREATE UNIQUE INDEX "BiDomesticViolenceResponse_apiId_key"
ON "BiDomesticViolenceResponse"("apiId");
