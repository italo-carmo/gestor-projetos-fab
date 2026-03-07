CREATE TABLE "LessonLearnedType" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "colorHex" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LessonLearnedType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LessonLearnedType_name_key" ON "LessonLearnedType"("name");
CREATE INDEX "LessonLearnedType_createdAt_idx" ON "LessonLearnedType"("createdAt");

INSERT INTO "LessonLearnedType" ("id", "name", "colorHex", "createdAt", "updatedAt")
SELECT 'lesson_type_attention', 'Ponto de atenção', '#F4C542', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "LessonLearnedType" t WHERE LOWER(t."name") = LOWER('Ponto de atenção')
);

INSERT INTO "LessonLearnedType" ("id", "name", "colorHex", "createdAt", "updatedAt")
SELECT 'lesson_type_positive', 'Resultados positivos', '#8E44AD', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "LessonLearnedType" t WHERE LOWER(t."name") = LOWER('Resultados positivos')
);

INSERT INTO "LessonLearnedType" ("id", "name", "colorHex", "createdAt", "updatedAt")
SELECT 'lesson_type_psychology', 'Psicologia', '#2E8B57', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "LessonLearnedType" t WHERE LOWER(t."name") = LOWER('Psicologia')
);

ALTER TABLE "LessonLearnedPost"
  ADD COLUMN "typeId" TEXT;

UPDATE "LessonLearnedPost"
SET "typeId" = (
  SELECT t."id"
  FROM "LessonLearnedType" t
  WHERE LOWER(t."name") = LOWER('Resultados positivos')
  LIMIT 1
)
WHERE "typeId" IS NULL;

ALTER TABLE "LessonLearnedPost"
  ALTER COLUMN "typeId" SET NOT NULL;

CREATE INDEX "LessonLearnedPost_typeId_createdAt_idx" ON "LessonLearnedPost"("typeId", "createdAt");

ALTER TABLE "LessonLearnedPost"
  ADD CONSTRAINT "LessonLearnedPost_typeId_fkey"
  FOREIGN KEY ("typeId") REFERENCES "LessonLearnedType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

