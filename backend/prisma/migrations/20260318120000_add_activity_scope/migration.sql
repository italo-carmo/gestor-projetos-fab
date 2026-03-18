-- CreateEnum
CREATE TYPE "ActivityScope" AS ENUM ('SMIF', 'CIPAVD');

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN "scope" "ActivityScope" NOT NULL DEFAULT 'SMIF';

-- CreateIndex
CREATE INDEX "Activity_scope_idx" ON "Activity"("scope");
