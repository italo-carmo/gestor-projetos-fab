-- CreateTable
CREATE TABLE "BiDomesticViolenceImportBatch" (
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

  CONSTRAINT "BiDomesticViolenceImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiDomesticViolenceResponse" (
  "id" TEXT NOT NULL,
  "batchId" TEXT,
  "submittedAt" TIMESTAMP(3),
  "age" INTEGER,
  "organization" TEXT,
  "maritalStatus" TEXT,
  "education" TEXT,
  "fabBond" TEXT,
  "rank" TEXT,
  "sufferedLifetimeRaw" TEXT,
  "sufferedLifetime" BOOLEAN,
  "sufferedLast12MonthsRaw" TEXT,
  "sufferedLast12Months" BOOLEAN,
  "frequency" TEXT,
  "violenceTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "authorMilitaryLink" TEXT,
  "occurrencePlace" TEXT,
  "witnessesRaw" TEXT,
  "witnesses" BOOLEAN,
  "impactIntensity" TEXT,
  "impactAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "soughtHelpRaw" TEXT,
  "soughtHelp" BOOLEAN,
  "complaintChannels" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "noComplaintReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "rawPayload" JSONB,
  "sourceRow" INTEGER,
  "sourceHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BiDomesticViolenceResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BiDomesticViolenceImportBatch_importedAt_idx" ON "BiDomesticViolenceImportBatch"("importedAt");

-- CreateIndex
CREATE INDEX "BiDomesticViolenceImportBatch_importedById_importedAt_idx" ON "BiDomesticViolenceImportBatch"("importedById", "importedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BiDomesticViolenceResponse_sourceHash_key" ON "BiDomesticViolenceResponse"("sourceHash");

-- CreateIndex
CREATE INDEX "BiDomesticViolenceResponse_submittedAt_idx" ON "BiDomesticViolenceResponse"("submittedAt");

-- CreateIndex
CREATE INDEX "BiDomesticViolenceResponse_organization_rank_idx" ON "BiDomesticViolenceResponse"("organization", "rank");

-- CreateIndex
CREATE INDEX "BiDomesticViolenceResponse_sufferedLifetime_sufferedLast12Months_idx" ON "BiDomesticViolenceResponse"("sufferedLifetime", "sufferedLast12Months");

-- CreateIndex
CREATE INDEX "BiDomesticViolenceResponse_impactIntensity_idx" ON "BiDomesticViolenceResponse"("impactIntensity");

-- CreateIndex
CREATE INDEX "BiDomesticViolenceResponse_soughtHelp_idx" ON "BiDomesticViolenceResponse"("soughtHelp");

-- CreateIndex
CREATE INDEX "BiDomesticViolenceResponse_batchId_idx" ON "BiDomesticViolenceResponse"("batchId");

-- AddForeignKey
ALTER TABLE "BiDomesticViolenceImportBatch"
ADD CONSTRAINT "BiDomesticViolenceImportBatch_importedById_fkey"
FOREIGN KEY ("importedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiDomesticViolenceResponse"
ADD CONSTRAINT "BiDomesticViolenceResponse_batchId_fkey"
FOREIGN KEY ("batchId") REFERENCES "BiDomesticViolenceImportBatch"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
