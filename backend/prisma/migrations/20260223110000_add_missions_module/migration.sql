-- Missions module: mission entity, participants and schedule

CREATE TABLE "Mission" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "localityId" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MissionParticipant" (
  "id" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "userId" TEXT,
  "ldapUid" TEXT,
  "cpf" TEXT,
  "email" TEXT,
  "name" TEXT NOT NULL,
  "fabom" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MissionParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MissionScheduleItem" (
  "id" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "startAt" TIMESTAMP(3) NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "location" TEXT NOT NULL,
  "responsible" TEXT NOT NULL,
  "participants" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MissionScheduleItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Mission_localityId_startDate_idx" ON "Mission"("localityId", "startDate");
CREATE INDEX "Mission_startDate_endDate_idx" ON "Mission"("startDate", "endDate");
CREATE INDEX "MissionParticipant_missionId_createdAt_idx" ON "MissionParticipant"("missionId", "createdAt");
CREATE INDEX "MissionParticipant_userId_idx" ON "MissionParticipant"("userId");
CREATE INDEX "MissionScheduleItem_missionId_startAt_idx" ON "MissionScheduleItem"("missionId", "startAt");

ALTER TABLE "Mission"
  ADD CONSTRAINT "Mission_localityId_fkey"
  FOREIGN KEY ("localityId") REFERENCES "Locality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Mission"
  ADD CONSTRAINT "Mission_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MissionParticipant"
  ADD CONSTRAINT "MissionParticipant_missionId_fkey"
  FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MissionParticipant"
  ADD CONSTRAINT "MissionParticipant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MissionScheduleItem"
  ADD CONSTRAINT "MissionScheduleItem_missionId_fkey"
  FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
