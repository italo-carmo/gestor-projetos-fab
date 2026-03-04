-- Rename legacy activity type label to the new business term.
UPDATE "ActivityType"
SET "name" = 'Acompanhamento',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" IN ('Rotina de Recrutas', 'Rotina das Recrutas');

