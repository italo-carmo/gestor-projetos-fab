CREATE TYPE "CpcaPresidentRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "CpcaCommissionPresident" (
  "id" TEXT NOT NULL,
  "localityId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "assignedByUserId" TEXT,
  "designationBulletin" TEXT,
  "isSubstitution" BOOLEAN NOT NULL DEFAULT false,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CpcaCommissionPresident_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CpcaCommissionMember" (
  "id" TEXT NOT NULL,
  "localityId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "addedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CpcaCommissionMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CpcaPresidentSelfRegistration" (
  "id" TEXT NOT NULL,
  "localityId" TEXT NOT NULL,
  "applicantUserId" TEXT NOT NULL,
  "applicantIdentifier" TEXT NOT NULL,
  "applicantUid" TEXT NOT NULL,
  "applicantEmail" TEXT,
  "applicantName" TEXT NOT NULL,
  "requestedAsSubstitution" BOOLEAN NOT NULL DEFAULT false,
  "bulletinNumber" TEXT NOT NULL,
  "status" "CpcaPresidentRequestStatus" NOT NULL DEFAULT 'PENDING',
  "decidedByUserId" TEXT,
  "decidedAt" TIMESTAMP(3),
  "decisionNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CpcaPresidentSelfRegistration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CpcaCommissionPresident_localityId_key" ON "CpcaCommissionPresident"("localityId");

CREATE INDEX "CpcaCommissionPresident_userId_idx" ON "CpcaCommissionPresident"("userId");
CREATE INDEX "CpcaCommissionPresident_assignedByUserId_idx" ON "CpcaCommissionPresident"("assignedByUserId");
CREATE INDEX "CpcaCommissionPresident_assignedAt_idx" ON "CpcaCommissionPresident"("assignedAt");

CREATE UNIQUE INDEX "CpcaCommissionMember_localityId_userId_key" ON "CpcaCommissionMember"("localityId", "userId");
CREATE INDEX "CpcaCommissionMember_localityId_idx" ON "CpcaCommissionMember"("localityId");
CREATE INDEX "CpcaCommissionMember_userId_idx" ON "CpcaCommissionMember"("userId");
CREATE INDEX "CpcaCommissionMember_addedByUserId_idx" ON "CpcaCommissionMember"("addedByUserId");

CREATE INDEX "CpcaPresidentSelfRegistration_status_createdAt_idx" ON "CpcaPresidentSelfRegistration"("status", "createdAt");
CREATE INDEX "CpcaPresidentSelfRegistration_localityId_status_idx" ON "CpcaPresidentSelfRegistration"("localityId", "status");
CREATE INDEX "CpcaPresidentSelfRegistration_applicantUserId_idx" ON "CpcaPresidentSelfRegistration"("applicantUserId");
CREATE INDEX "CpcaPresidentSelfRegistration_decidedByUserId_idx" ON "CpcaPresidentSelfRegistration"("decidedByUserId");

ALTER TABLE "CpcaCommissionPresident"
ADD CONSTRAINT "CpcaCommissionPresident_localityId_fkey"
FOREIGN KEY ("localityId") REFERENCES "Locality"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CpcaCommissionPresident"
ADD CONSTRAINT "CpcaCommissionPresident_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CpcaCommissionPresident"
ADD CONSTRAINT "CpcaCommissionPresident_assignedByUserId_fkey"
FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CpcaCommissionMember"
ADD CONSTRAINT "CpcaCommissionMember_localityId_fkey"
FOREIGN KEY ("localityId") REFERENCES "Locality"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CpcaCommissionMember"
ADD CONSTRAINT "CpcaCommissionMember_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CpcaCommissionMember"
ADD CONSTRAINT "CpcaCommissionMember_addedByUserId_fkey"
FOREIGN KEY ("addedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CpcaPresidentSelfRegistration"
ADD CONSTRAINT "CpcaPresidentSelfRegistration_localityId_fkey"
FOREIGN KEY ("localityId") REFERENCES "Locality"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CpcaPresidentSelfRegistration"
ADD CONSTRAINT "CpcaPresidentSelfRegistration_applicantUserId_fkey"
FOREIGN KEY ("applicantUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CpcaPresidentSelfRegistration"
ADD CONSTRAINT "CpcaPresidentSelfRegistration_decidedByUserId_fkey"
FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
