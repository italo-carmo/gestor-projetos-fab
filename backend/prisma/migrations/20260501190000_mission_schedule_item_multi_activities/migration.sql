-- Allow one mission schedule item to be linked to multiple field activities.
-- The legacy MissionScheduleItem.activityId column is preserved as the primary
-- compatibility link and backfilled into the new relation table.

CREATE TABLE "MissionScheduleItemActivity" (
  "id" TEXT NOT NULL,
  "scheduleItemId" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MissionScheduleItemActivity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MissionScheduleItemActivity_scheduleItemId_activityId_key"
ON "MissionScheduleItemActivity"("scheduleItemId", "activityId");

CREATE INDEX "MissionScheduleItemActivity_activityId_idx"
ON "MissionScheduleItemActivity"("activityId");

CREATE INDEX "MissionScheduleItemActivity_scheduleItemId_createdAt_idx"
ON "MissionScheduleItemActivity"("scheduleItemId", "createdAt");

ALTER TABLE "MissionScheduleItemActivity"
ADD CONSTRAINT "MissionScheduleItemActivity_scheduleItemId_fkey"
FOREIGN KEY ("scheduleItemId")
REFERENCES "MissionScheduleItem"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "MissionScheduleItemActivity"
ADD CONSTRAINT "MissionScheduleItemActivity_activityId_fkey"
FOREIGN KEY ("activityId")
REFERENCES "Activity"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

INSERT INTO "MissionScheduleItemActivity" ("id", "scheduleItemId", "activityId", "createdAt")
SELECT
  concat('msia_', substr(md5(msi."id" || ':' || msi."activityId"), 1, 20)),
  msi."id",
  msi."activityId",
  COALESCE(msi."updatedAt", msi."createdAt", CURRENT_TIMESTAMP)
FROM "MissionScheduleItem" msi
WHERE msi."activityId" IS NOT NULL
ON CONFLICT ("scheduleItemId", "activityId") DO NOTHING;
