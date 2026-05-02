ALTER TABLE "BiCpcaMeetingImportBatch"
  ADD COLUMN "apiSinceId" INTEGER,
  ADD COLUMN "apiNextSinceId" INTEGER,
  ADD COLUMN "apiLastIdAvailable" INTEGER,
  ADD COLUMN "apiHasMore" BOOLEAN,
  ADD COLUMN "apiUpdatedAt" TIMESTAMP(3);

ALTER TABLE "BiCpcaMeetingResponse"
  ADD COLUMN "apiId" INTEGER;

CREATE UNIQUE INDEX "BiCpcaMeetingResponse_apiId_key" ON "BiCpcaMeetingResponse"("apiId");
