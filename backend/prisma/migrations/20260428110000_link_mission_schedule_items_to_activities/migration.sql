-- Link mission schedule items to field activities created or curated from the mission flow.
ALTER TABLE "MissionScheduleItem"
ADD COLUMN "activityId" TEXT;

CREATE INDEX "MissionScheduleItem_activityId_idx"
ON "MissionScheduleItem"("activityId");

ALTER TABLE "MissionScheduleItem"
ADD CONSTRAINT "MissionScheduleItem_activityId_fkey"
FOREIGN KEY ("activityId")
REFERENCES "Activity"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
