INSERT INTO "Specialty" ("id", "name", "createdAt", "updatedAt")
SELECT 'specialty_doutrina', 'Doutrina', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "Specialty" WHERE "name" = 'Doutrina'
);
