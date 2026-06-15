ALTER TABLE "BiRecruitsImportBatch"
ADD COLUMN "apiSinceId" INTEGER,
ADD COLUMN "apiNextSinceId" INTEGER,
ADD COLUMN "apiLastIdAvailable" INTEGER,
ADD COLUMN "apiHasMore" BOOLEAN,
ADD COLUMN "apiUpdatedAt" TIMESTAMP(3);

ALTER TABLE "BiRecruitsResponse"
ADD COLUMN "apiId" INTEGER;

CREATE UNIQUE INDEX "BiRecruitsResponse_apiId_key" ON "BiRecruitsResponse"("apiId");
