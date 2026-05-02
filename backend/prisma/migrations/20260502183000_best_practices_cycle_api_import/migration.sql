ALTER TABLE "BiBestPracticeCycleImportBatch"
  ADD COLUMN "apiSinceId" INTEGER,
  ADD COLUMN "apiNextSinceId" INTEGER,
  ADD COLUMN "apiLastIdAvailable" INTEGER,
  ADD COLUMN "apiHasMore" BOOLEAN,
  ADD COLUMN "apiUpdatedAt" TIMESTAMP(3);

ALTER TABLE "BiBestPracticeCycleResponse"
  ADD COLUMN "apiId" INTEGER;

CREATE UNIQUE INDEX "BiBestPracticeCycleResponse_apiId_key" ON "BiBestPracticeCycleResponse"("apiId");
