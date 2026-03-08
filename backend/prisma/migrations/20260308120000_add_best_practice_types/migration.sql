-- CreateTable
CREATE TABLE IF NOT EXISTS "BestPracticeType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "colorHex" TEXT NOT NULL,
    "textColorHex" TEXT DEFAULT '#FFFFFF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BestPracticeType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BestPracticeType_name_key" ON "BestPracticeType"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BestPracticeType_createdAt_idx" ON "BestPracticeType"("createdAt");

-- AlterTable
ALTER TABLE "BestPracticePost" ADD COLUMN IF NOT EXISTS "typeId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BestPracticePost_typeId_idx" ON "BestPracticePost"("typeId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "BestPracticePost" ADD CONSTRAINT "BestPracticePost_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "BestPracticeType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Seed default types
INSERT INTO "BestPracticeType" ("id", "name", "colorHex", "textColorHex", "createdAt", "updatedAt")
VALUES
  ('best_practice_type_commission', 'Práticas com potencial de replicação', '#668576', '#FFFFFF', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('best_practice_type_locality', 'Boas práticas da localidade', '#537F97', '#FFFFFF', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

