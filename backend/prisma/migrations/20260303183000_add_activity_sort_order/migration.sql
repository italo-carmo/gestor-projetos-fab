-- Add persistent ordering for activities list (drag and drop in UI)
ALTER TABLE "Activity"
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Initialize a stable order based on creation time (oldest first)
WITH ordered AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC) - 1 AS rn
  FROM "Activity"
)
UPDATE "Activity" a
SET "sortOrder" = ordered.rn
FROM ordered
WHERE ordered."id" = a."id";

CREATE INDEX "Activity_sortOrder_idx" ON "Activity"("sortOrder");

