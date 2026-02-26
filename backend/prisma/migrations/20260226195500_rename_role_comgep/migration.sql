-- Rename legacy role name to canonical short name used in UI.
UPDATE "Role"
SET "name" = 'COMGEP',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = 'Comandante COMGEP'
  AND NOT EXISTS (
    SELECT 1
    FROM "Role"
    WHERE "name" = 'COMGEP'
  );
