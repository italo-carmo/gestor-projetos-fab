-- CreateTable
CREATE TABLE "ActivityType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActivityType_name_key" ON "ActivityType"("name");

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN "activityTypeId" TEXT;

-- CreateIndex
CREATE INDEX "Activity_activityTypeId_idx" ON "Activity"("activityTypeId");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_activityTypeId_fkey" FOREIGN KEY ("activityTypeId") REFERENCES "ActivityType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default activity types
INSERT INTO "ActivityType" ("id", "name", "createdAt", "updatedAt")
VALUES
  ('activity_type_rotina_recrutas', 'Rotina de Recrutas', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('activity_type_breafing', 'Breafing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('activity_type_ciclo_boas_praticas', 'Ciclo de Boas Práticas', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('activity_type_questionario', 'Questionário', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('activity_type_palestra', 'Palestra', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('activity_type_visita', 'Visita', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

