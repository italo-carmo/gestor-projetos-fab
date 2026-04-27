ALTER TABLE "ActivityType"
ADD COLUMN "scope" "ActivityScope";

WITH usage_scope AS (
  SELECT
    at.id,
    CASE
      WHEN COUNT(DISTINCT a."scope") = 1
       AND MAX(a."scope") = 'CIPAVD'::"ActivityScope"
        THEN 'CIPAVD'::"ActivityScope"
      ELSE 'SMIF'::"ActivityScope"
    END AS resolved_scope
  FROM "ActivityType" at
  LEFT JOIN "Activity" a
    ON a."activityTypeId" = at.id
  GROUP BY at.id
)
UPDATE "ActivityType" at
SET "scope" = usage_scope.resolved_scope
FROM usage_scope
WHERE usage_scope.id = at.id;

ALTER TABLE "ActivityType"
ALTER COLUMN "scope" SET NOT NULL;

ALTER TABLE "ActivityType"
ALTER COLUMN "scope" SET DEFAULT 'SMIF';

ALTER TABLE "ActivityType"
DROP CONSTRAINT IF EXISTS "ActivityType_name_key";

CREATE INDEX "ActivityType_scope_idx"
ON "ActivityType"("scope");

CREATE UNIQUE INDEX "ActivityType_scope_name_key"
ON "ActivityType"("scope", "name");

WITH mixed AS (
  SELECT
    at.id,
    at.name,
    at."createdAt",
    at."updatedAt"
  FROM "ActivityType" at
  JOIN "Activity" a
    ON a."activityTypeId" = at.id
  GROUP BY at.id, at.name, at."createdAt", at."updatedAt"
  HAVING COUNT(DISTINCT a."scope") > 1
),
inserted AS (
  INSERT INTO "ActivityType" ("id", "name", "scope", "createdAt", "updatedAt")
  SELECT
    'acttype_' || substr(md5(m.id || clock_timestamp()::text || random()::text), 1, 24),
    m.name,
    'CIPAVD'::"ActivityScope",
    m."createdAt",
    m."updatedAt"
  FROM mixed m
  RETURNING id, name
)
UPDATE "Activity" a
SET "activityTypeId" = inserted.id
FROM inserted
JOIN mixed m
  ON m.name = inserted.name
WHERE a."activityTypeId" = m.id
  AND a."scope" = 'CIPAVD'::"ActivityScope";

DELETE FROM "ActivityType" at
WHERE at.name = 'Recrutas (Efetivo feminino)'
  AND NOT EXISTS (
    SELECT 1
    FROM "Activity" a
    WHERE a."activityTypeId" = at.id
  );
