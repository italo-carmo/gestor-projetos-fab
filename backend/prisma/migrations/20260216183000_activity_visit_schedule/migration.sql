-- Visit schedule items for activities (cronograma de visita)

CREATE TABLE "ActivityVisitScheduleItem" (
  "id" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "startTime" TEXT NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "location" TEXT NOT NULL,
  "responsible" TEXT NOT NULL,
  "participants" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActivityVisitScheduleItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ActivityVisitScheduleItem_activityId_startTime_idx"
  ON "ActivityVisitScheduleItem"("activityId", "startTime");

ALTER TABLE "ActivityVisitScheduleItem"
  ADD CONSTRAINT "ActivityVisitScheduleItem_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
