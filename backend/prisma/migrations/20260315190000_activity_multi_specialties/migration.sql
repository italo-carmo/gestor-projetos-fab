CREATE TABLE "ActivitySpecialty" (
  "activityId" TEXT NOT NULL,
  "specialtyId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivitySpecialty_pkey" PRIMARY KEY ("activityId", "specialtyId")
);

CREATE INDEX "ActivitySpecialty_specialtyId_idx"
  ON "ActivitySpecialty"("specialtyId");

ALTER TABLE "ActivitySpecialty"
  ADD CONSTRAINT "ActivitySpecialty_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActivitySpecialty"
  ADD CONSTRAINT "ActivitySpecialty_specialtyId_fkey"
  FOREIGN KEY ("specialtyId") REFERENCES "Specialty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ActivitySpecialty" ("activityId", "specialtyId")
SELECT "id", "specialtyId"
FROM "Activity"
WHERE "specialtyId" IS NOT NULL
ON CONFLICT ("activityId", "specialtyId") DO NOTHING;
