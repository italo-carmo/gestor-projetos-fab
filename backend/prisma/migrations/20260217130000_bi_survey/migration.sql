-- CreateEnum
CREATE TYPE "BiImportFormat" AS ENUM ('CSV', 'XLSX');

-- CreateTable
CREATE TABLE "BiSurveyImportBatch" (
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

  CONSTRAINT "BiSurveyImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiSurveyResponse" (
  "id" TEXT NOT NULL,
  "batchId" TEXT,
  "submittedAt" TIMESTAMP(3),
  "sufferedViolenceRaw" TEXT,
  "sufferedViolence" BOOLEAN,
  "violenceTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "postoGraduacao" TEXT,
  "om" TEXT,
  "posto" TEXT,
  "autodeclara" TEXT,
  "extraColumn" TEXT,
  "rawPayload" JSONB,
  "sourceRow" INTEGER,
  "sourceHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BiSurveyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BiSurveyImportBatch_importedAt_idx" ON "BiSurveyImportBatch"("importedAt");

-- CreateIndex
CREATE INDEX "BiSurveyImportBatch_importedById_importedAt_idx" ON "BiSurveyImportBatch"("importedById", "importedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BiSurveyResponse_sourceHash_key" ON "BiSurveyResponse"("sourceHash");

-- CreateIndex
CREATE INDEX "BiSurveyResponse_submittedAt_idx" ON "BiSurveyResponse"("submittedAt");

-- CreateIndex
CREATE INDEX "BiSurveyResponse_sufferedViolence_om_idx" ON "BiSurveyResponse"("sufferedViolence", "om");

-- CreateIndex
CREATE INDEX "BiSurveyResponse_om_postoGraduacao_idx" ON "BiSurveyResponse"("om", "postoGraduacao");

-- CreateIndex
CREATE INDEX "BiSurveyResponse_posto_idx" ON "BiSurveyResponse"("posto");

-- CreateIndex
CREATE INDEX "BiSurveyResponse_autodeclara_idx" ON "BiSurveyResponse"("autodeclara");

-- CreateIndex
CREATE INDEX "BiSurveyResponse_batchId_idx" ON "BiSurveyResponse"("batchId");

-- AddForeignKey
ALTER TABLE "BiSurveyImportBatch"
ADD CONSTRAINT "BiSurveyImportBatch_importedById_fkey"
FOREIGN KEY ("importedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiSurveyResponse"
ADD CONSTRAINT "BiSurveyResponse_batchId_fkey"
FOREIGN KEY ("batchId") REFERENCES "BiSurveyImportBatch"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
