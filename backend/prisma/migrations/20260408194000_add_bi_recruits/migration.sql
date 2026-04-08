-- CreateTable
CREATE TABLE "BiRecruitsImportBatch" (
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

  CONSTRAINT "BiRecruitsImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiRecruitsResponse" (
  "id" TEXT NOT NULL,
  "batchId" TEXT,
  "submittedAt" TIMESTAMP(3),
  "education" TEXT,
  "gender" TEXT,
  "identifyHarassment" TEXT,
  "conductLimits" TEXT,
  "knowOrientation" TEXT,
  "knowReportProcess" TEXT,
  "willingnessOrientation" TEXT,
  "willingnessReport" TEXT,
  "enlistmentDecisionInfluenceText" TEXT,
  "suggestionComment" TEXT,
  "rawPayload" JSONB,
  "sourceRow" INTEGER,
  "sourceHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BiRecruitsResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BiRecruitsImportBatch_importedAt_idx" ON "BiRecruitsImportBatch"("importedAt");

-- CreateIndex
CREATE INDEX "BiRecruitsImportBatch_importedById_importedAt_idx" ON "BiRecruitsImportBatch"("importedById", "importedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BiRecruitsResponse_sourceHash_key" ON "BiRecruitsResponse"("sourceHash");

-- CreateIndex
CREATE INDEX "BiRecruitsResponse_submittedAt_idx" ON "BiRecruitsResponse"("submittedAt");

-- CreateIndex
CREATE INDEX "BiRecruitsResponse_education_gender_idx" ON "BiRecruitsResponse"("education", "gender");

-- CreateIndex
CREATE INDEX "BiRecruitsResponse_identifyHarassment_conductLimits_idx" ON "BiRecruitsResponse"("identifyHarassment", "conductLimits");

-- CreateIndex
CREATE INDEX "BiRecruitsResponse_knowOrientation_knowReportProcess_idx" ON "BiRecruitsResponse"("knowOrientation", "knowReportProcess");

-- CreateIndex
CREATE INDEX "BiRecruitsResponse_willingnessOrientation_willingnessReport_idx" ON "BiRecruitsResponse"("willingnessOrientation", "willingnessReport");

-- CreateIndex
CREATE INDEX "BiRecruitsResponse_enlistmentDecisionInfluenceText_idx" ON "BiRecruitsResponse"("enlistmentDecisionInfluenceText");

-- CreateIndex
CREATE INDEX "BiRecruitsResponse_batchId_idx" ON "BiRecruitsResponse"("batchId");

-- AddForeignKey
ALTER TABLE "BiRecruitsImportBatch"
ADD CONSTRAINT "BiRecruitsImportBatch_importedById_fkey"
FOREIGN KEY ("importedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiRecruitsResponse"
ADD CONSTRAINT "BiRecruitsResponse_batchId_fkey"
FOREIGN KEY ("batchId") REFERENCES "BiRecruitsImportBatch"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
