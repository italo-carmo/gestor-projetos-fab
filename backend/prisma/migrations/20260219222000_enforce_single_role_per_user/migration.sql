-- Ensure exactly one role row per user by keeping the first row and removing extras.
WITH ranked AS (
  SELECT
    id,
    "userId",
    ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY id) AS rn
  FROM "UserRole"
)
DELETE FROM "UserRole" ur
USING ranked r
WHERE ur.id = r.id
  AND r.rn > 1;

-- Enforce one-role-per-user at database level.
CREATE UNIQUE INDEX IF NOT EXISTS "UserRole_userId_key"
ON "UserRole" ("userId");
