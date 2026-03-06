-- Create "Comissão CIPAVD" specialty if it doesn't exist
INSERT INTO "Specialty" (id, name, "createdAt", "updatedAt")
SELECT 
  'cmlpet4hx004nzpvc1pidom2i'::text,
  'Comissão CIPAVD',
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "Specialty" WHERE name = 'Comissão CIPAVD'
);

-- Update all activities with null specialtyId to use "Comissão CIPAVD"
UPDATE "Activity"
SET "specialtyId" = (SELECT id FROM "Specialty" WHERE name = 'Comissão CIPAVD')
WHERE "specialtyId" IS NULL
  AND (SELECT id FROM "Specialty" WHERE name = 'Comissão CIPAVD') IS NOT NULL;

