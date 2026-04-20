-- CPCA commission homologation flow hardening

CREATE TYPE "CpcaCommissionPresidentAssignmentSource" AS ENUM (
  'DIRECT_ASSIGNMENT',
  'SELF_REGISTRATION_APPROVAL',
  'PRESIDENT_NOMINATION_APPROVAL'
);

ALTER TABLE "CpcaCommissionPresident"
  ADD COLUMN "assignmentSource" "CpcaCommissionPresidentAssignmentSource" NOT NULL DEFAULT 'DIRECT_ASSIGNMENT';

CREATE TABLE "CpcaPresidentNominationRequest" (
  "id" TEXT NOT NULL,
  "omId" TEXT,
  "requestedByUserId" TEXT NOT NULL,
  "nomineeUserId" TEXT NOT NULL,
  "nomineeIdentifier" TEXT NOT NULL,
  "nomineeUid" TEXT NOT NULL,
  "nomineeEmail" TEXT,
  "nomineeName" TEXT NOT NULL,
  "requestedAsSubstitution" BOOLEAN NOT NULL DEFAULT true,
  "bulletinNumber" TEXT,
  "status" "CpcaPresidentRequestStatus" NOT NULL DEFAULT 'PENDING',
  "decidedByUserId" TEXT,
  "decidedAt" TIMESTAMP(3),
  "decisionNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CpcaPresidentNominationRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CpcaCommissionCoverageRequest" (
  "id" TEXT NOT NULL,
  "omId" TEXT,
  "requestedByUserId" TEXT NOT NULL,
  "requestedManagedOmIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "CpcaPresidentRequestStatus" NOT NULL DEFAULT 'PENDING',
  "decidedByUserId" TEXT,
  "decidedAt" TIMESTAMP(3),
  "decisionNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CpcaCommissionCoverageRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CpcaPresidentNominationRequest_status_createdAt_idx"
  ON "CpcaPresidentNominationRequest"("status", "createdAt");
CREATE INDEX "CpcaPresidentNominationRequest_omId_status_idx"
  ON "CpcaPresidentNominationRequest"("omId", "status");
CREATE INDEX "CpcaPresidentNominationRequest_requestedByUserId_idx"
  ON "CpcaPresidentNominationRequest"("requestedByUserId");
CREATE INDEX "CpcaPresidentNominationRequest_nomineeUserId_idx"
  ON "CpcaPresidentNominationRequest"("nomineeUserId");
CREATE INDEX "CpcaPresidentNominationRequest_decidedByUserId_idx"
  ON "CpcaPresidentNominationRequest"("decidedByUserId");

CREATE INDEX "CpcaCommissionCoverageRequest_status_createdAt_idx"
  ON "CpcaCommissionCoverageRequest"("status", "createdAt");
CREATE INDEX "CpcaCommissionCoverageRequest_omId_status_idx"
  ON "CpcaCommissionCoverageRequest"("omId", "status");
CREATE INDEX "CpcaCommissionCoverageRequest_requestedByUserId_idx"
  ON "CpcaCommissionCoverageRequest"("requestedByUserId");
CREATE INDEX "CpcaCommissionCoverageRequest_decidedByUserId_idx"
  ON "CpcaCommissionCoverageRequest"("decidedByUserId");

ALTER TABLE "CpcaPresidentNominationRequest"
  ADD CONSTRAINT "CpcaPresidentNominationRequest_omId_fkey"
    FOREIGN KEY ("omId") REFERENCES "Om"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "CpcaPresidentNominationRequest_requestedByUserId_fkey"
    FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "CpcaPresidentNominationRequest_nomineeUserId_fkey"
    FOREIGN KEY ("nomineeUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "CpcaPresidentNominationRequest_decidedByUserId_fkey"
    FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CpcaCommissionCoverageRequest"
  ADD CONSTRAINT "CpcaCommissionCoverageRequest_omId_fkey"
    FOREIGN KEY ("omId") REFERENCES "Om"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "CpcaCommissionCoverageRequest_requestedByUserId_fkey"
    FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "CpcaCommissionCoverageRequest_decidedByUserId_fkey"
    FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
