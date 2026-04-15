-- CreateEnum
CREATE TYPE "BiNormalizationSourceType" AS ENUM ('SURVEY_SCHOOLS', 'DOMESTIC_VIOLENCE', 'RECRUITS', 'BEST_PRACTICE_CYCLE', 'CPCA_MEETING', 'GSD_EVALUATION');

-- CreateEnum
CREATE TYPE "BiNormalizationStatus" AS ENUM ('MATCHED', 'UF_ONLY', 'NOT_FOUND', 'NOT_APPLICABLE');

-- CreateTable
CREATE TABLE "BiNormalizationLink" (
    "id" TEXT NOT NULL,
    "sourceType" "BiNormalizationSourceType" NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceBatchId" TEXT,
    "rawReference" TEXT,
    "secondaryReference" TEXT,
    "omId" TEXT,
    "uf" TEXT,
    "status" "BiNormalizationStatus" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "resolutionMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BiNormalizationLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BiNormalizationLink_sourceType_sourceRecordId_key" ON "BiNormalizationLink"("sourceType", "sourceRecordId");

-- CreateIndex
CREATE INDEX "BiNormalizationLink_sourceType_status_idx" ON "BiNormalizationLink"("sourceType", "status");

-- CreateIndex
CREATE INDEX "BiNormalizationLink_omId_idx" ON "BiNormalizationLink"("omId");

-- CreateIndex
CREATE INDEX "BiNormalizationLink_uf_idx" ON "BiNormalizationLink"("uf");

-- CreateIndex
CREATE INDEX "BiNormalizationLink_sourceBatchId_idx" ON "BiNormalizationLink"("sourceBatchId");

-- AddForeignKey
ALTER TABLE "BiNormalizationLink"
ADD CONSTRAINT "BiNormalizationLink_omId_fkey"
FOREIGN KEY ("omId") REFERENCES "Om"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
