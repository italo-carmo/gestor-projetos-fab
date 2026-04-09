CREATE TABLE "BiBestPracticeCycleImportBatch" (
  "id" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "format" "BiImportFormat" NOT NULL,
  "sheetName" TEXT,
  "totalRows" INTEGER NOT NULL,
  "insertedRows" INTEGER NOT NULL,
  "duplicateRows" INTEGER NOT NULL,
  "invalidRows" INTEGER NOT NULL,
  "importedById" TEXT,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BiBestPracticeCycleImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BiBestPracticeCycleResponse" (
  "id" TEXT NOT NULL,
  "batchId" TEXT,
  "submittedAt" TIMESTAMP(3),
  "technicalRigorPerception" TEXT,
  "preparednessToLeadMixedClass" TEXT,
  "genderBiasImpact" TEXT,
  "interactionDifference" TEXT,
  "interactionDifferenceComment" TEXT,
  "supportNeedRecognition" TEXT,
  "mainChallengeOptions" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "identification" TEXT,
  "specialty" TEXT,
  "rawPayload" JSONB,
  "sourceRow" INTEGER,
  "sourceHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BiBestPracticeCycleResponse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BiBestPracticeCycleCardSetting" (
  "id" TEXT NOT NULL,
  "cardId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BiBestPracticeCycleCardSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BiBestPracticeCycleResponse_sourceHash_key"
  ON "BiBestPracticeCycleResponse"("sourceHash");

CREATE UNIQUE INDEX "BiBestPracticeCycleCardSetting_cardId_key"
  ON "BiBestPracticeCycleCardSetting"("cardId");

CREATE INDEX "BiBestPracticeCycleImportBatch_importedAt_idx"
  ON "BiBestPracticeCycleImportBatch"("importedAt");

CREATE INDEX "BiBestPracticeCycleImportBatch_importedById_importedAt_idx"
  ON "BiBestPracticeCycleImportBatch"("importedById", "importedAt");

CREATE INDEX "BiBestPracticeCycleResponse_submittedAt_idx"
  ON "BiBestPracticeCycleResponse"("submittedAt");

CREATE INDEX "BiBestPracticeCycleResponse_technicalRigorPerception_preparedness_idx"
  ON "BiBestPracticeCycleResponse"("technicalRigorPerception", "preparednessToLeadMixedClass");

CREATE INDEX "BiBestPracticeCycleResponse_interactionDifference_supportNeed_idx"
  ON "BiBestPracticeCycleResponse"("interactionDifference", "supportNeedRecognition");

CREATE INDEX "BiBestPracticeCycleResponse_identification_idx"
  ON "BiBestPracticeCycleResponse"("identification");

CREATE INDEX "BiBestPracticeCycleResponse_specialty_idx"
  ON "BiBestPracticeCycleResponse"("specialty");

CREATE INDEX "BiBestPracticeCycleResponse_batchId_idx"
  ON "BiBestPracticeCycleResponse"("batchId");

CREATE INDEX "BiBestPracticeCycleCardSetting_updatedAt_idx"
  ON "BiBestPracticeCycleCardSetting"("updatedAt");

ALTER TABLE "BiBestPracticeCycleImportBatch"
  ADD CONSTRAINT "BiBestPracticeCycleImportBatch_importedById_fkey"
  FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BiBestPracticeCycleResponse"
  ADD CONSTRAINT "BiBestPracticeCycleResponse_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "BiBestPracticeCycleImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BiBestPracticeCycleCardSetting"
  ADD CONSTRAINT "BiBestPracticeCycleCardSetting_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
