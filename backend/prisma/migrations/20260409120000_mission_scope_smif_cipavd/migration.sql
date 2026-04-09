-- AlterTable
ALTER TABLE "Mission" ADD COLUMN "scope" "ActivityScope" NOT NULL DEFAULT 'SMIF';

-- CreateIndex
CREATE INDEX "Mission_scope_localityId_idx" ON "Mission"("scope", "localityId");
