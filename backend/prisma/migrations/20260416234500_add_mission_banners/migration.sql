CREATE TABLE "MissionBanner" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "eventDate" TEXT NOT NULL,
    "eventTime" TEXT NOT NULL,
    "locationPrimary" TEXT NOT NULL,
    "locationSecondary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MissionBanner_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MissionBanner_missionId_eventDate_eventTime_idx" ON "MissionBanner"("missionId", "eventDate", "eventTime");

ALTER TABLE "MissionBanner"
ADD CONSTRAINT "MissionBanner_missionId_fkey"
FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
