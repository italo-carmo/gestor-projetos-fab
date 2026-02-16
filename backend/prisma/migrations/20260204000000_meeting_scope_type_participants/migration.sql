-- CreateEnum
CREATE TYPE "MeetingType" AS ENUM ('ONLINE', 'PRESENCIAL');

-- AlterTable Meeting: add meetingType and meetingLink
ALTER TABLE "Meeting" ADD COLUMN "meetingType" "MeetingType" NOT NULL DEFAULT 'PRESENCIAL';
ALTER TABLE "Meeting" ADD COLUMN "meetingLink" TEXT;

-- Convert scope from enum to text (preserve existing values as text)
ALTER TABLE "Meeting" ALTER COLUMN "scope" TYPE TEXT USING "scope"::text;
ALTER TABLE "Meeting" ALTER COLUMN "scope" SET DEFAULT '';

-- DropEnum (MeetingScope no longer used)
DROP TYPE "MeetingScope";

-- CreateTable MeetingParticipant
CREATE TABLE "MeetingParticipant" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "MeetingParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MeetingParticipant_meetingId_userId_key" ON "MeetingParticipant"("meetingId", "userId");
CREATE INDEX "MeetingParticipant_meetingId_idx" ON "MeetingParticipant"("meetingId");
CREATE INDEX "MeetingParticipant_userId_idx" ON "MeetingParticipant"("userId");

-- AddForeignKey
ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
