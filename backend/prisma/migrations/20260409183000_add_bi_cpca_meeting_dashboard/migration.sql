CREATE TABLE "BiCpcaMeetingImportBatch" (
  "id" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "format" "BiImportFormat" NOT NULL,
  "sheetName" TEXT,
  "columnsJson" JSONB,
  "totalRows" INTEGER NOT NULL,
  "insertedRows" INTEGER NOT NULL,
  "duplicateRows" INTEGER NOT NULL,
  "invalidRows" INTEGER NOT NULL,
  "importedById" TEXT,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BiCpcaMeetingImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BiCpcaMeetingResponse" (
  "id" TEXT NOT NULL,
  "batchId" TEXT,
  "submittedAt" TIMESTAMP(3),
  "answersJson" JSONB,
  "rawPayload" JSONB,
  "sourceRow" INTEGER,
  "sourceHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BiCpcaMeetingResponse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BiCpcaMeetingCardSetting" (
  "id" TEXT NOT NULL,
  "cardId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BiCpcaMeetingCardSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BiCpcaMeetingResponse_sourceHash_key"
  ON "BiCpcaMeetingResponse"("sourceHash");

CREATE UNIQUE INDEX "BiCpcaMeetingCardSetting_cardId_key"
  ON "BiCpcaMeetingCardSetting"("cardId");

CREATE INDEX "BiCpcaMeetingImportBatch_importedAt_idx"
  ON "BiCpcaMeetingImportBatch"("importedAt");

CREATE INDEX "BiCpcaMeetingImportBatch_importedById_importedAt_idx"
  ON "BiCpcaMeetingImportBatch"("importedById", "importedAt");

CREATE INDEX "BiCpcaMeetingResponse_submittedAt_idx"
  ON "BiCpcaMeetingResponse"("submittedAt");

CREATE INDEX "BiCpcaMeetingResponse_batchId_idx"
  ON "BiCpcaMeetingResponse"("batchId");

CREATE INDEX "BiCpcaMeetingCardSetting_updatedAt_idx"
  ON "BiCpcaMeetingCardSetting"("updatedAt");

ALTER TABLE "BiCpcaMeetingImportBatch"
  ADD CONSTRAINT "BiCpcaMeetingImportBatch_importedById_fkey"
  FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BiCpcaMeetingResponse"
  ADD CONSTRAINT "BiCpcaMeetingResponse_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "BiCpcaMeetingImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BiCpcaMeetingCardSetting"
  ADD CONSTRAINT "BiCpcaMeetingCardSetting_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
