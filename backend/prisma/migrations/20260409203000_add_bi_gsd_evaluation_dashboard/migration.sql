CREATE TABLE "BiGsdEvaluationImportBatch" (
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

  CONSTRAINT "BiGsdEvaluationImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BiGsdEvaluationResponse" (
  "id" TEXT NOT NULL,
  "batchId" TEXT,
  "submittedAt" TIMESTAMP(3),
  "answersJson" JSONB,
  "rawPayload" JSONB,
  "sourceRow" INTEGER,
  "sourceHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BiGsdEvaluationResponse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BiGsdEvaluationCardSetting" (
  "id" TEXT NOT NULL,
  "cardId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BiGsdEvaluationCardSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BiGsdEvaluationResponse_sourceHash_key"
  ON "BiGsdEvaluationResponse"("sourceHash");

CREATE UNIQUE INDEX "BiGsdEvaluationCardSetting_cardId_key"
  ON "BiGsdEvaluationCardSetting"("cardId");

CREATE INDEX "BiGsdEvaluationImportBatch_importedAt_idx"
  ON "BiGsdEvaluationImportBatch"("importedAt");

CREATE INDEX "BiGsdEvaluationImportBatch_importedById_importedAt_idx"
  ON "BiGsdEvaluationImportBatch"("importedById", "importedAt");

CREATE INDEX "BiGsdEvaluationResponse_submittedAt_idx"
  ON "BiGsdEvaluationResponse"("submittedAt");

CREATE INDEX "BiGsdEvaluationResponse_batchId_idx"
  ON "BiGsdEvaluationResponse"("batchId");

CREATE INDEX "BiGsdEvaluationCardSetting_updatedAt_idx"
  ON "BiGsdEvaluationCardSetting"("updatedAt");

ALTER TABLE "BiGsdEvaluationImportBatch"
  ADD CONSTRAINT "BiGsdEvaluationImportBatch_importedById_fkey"
  FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BiGsdEvaluationResponse"
  ADD CONSTRAINT "BiGsdEvaluationResponse_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "BiGsdEvaluationImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BiGsdEvaluationCardSetting"
  ADD CONSTRAINT "BiGsdEvaluationCardSetting_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
