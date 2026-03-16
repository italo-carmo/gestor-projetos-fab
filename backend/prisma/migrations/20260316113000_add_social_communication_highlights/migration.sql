-- CreateEnum
CREATE TYPE "SocialCommunicationHighlightImpact" AS ENUM ('MULTIPLICADOR', 'SIMBOLICO');

-- CreateTable
CREATE TABLE "SocialCommunicationHighlight" (
    "id" TEXT NOT NULL,
    "ldapUid" TEXT,
    "militaryEmail" TEXT NOT NULL,
    "militaryName" TEXT NOT NULL,
    "fabom" TEXT,
    "impact" "SocialCommunicationHighlightImpact" NOT NULL,
    "localityId" TEXT NOT NULL,
    "highlightText" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialCommunicationHighlight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SocialCommunicationHighlight_impact_createdAt_idx" ON "SocialCommunicationHighlight"("impact", "createdAt");

-- CreateIndex
CREATE INDEX "SocialCommunicationHighlight_localityId_createdAt_idx" ON "SocialCommunicationHighlight"("localityId", "createdAt");

-- CreateIndex
CREATE INDEX "SocialCommunicationHighlight_militaryEmail_idx" ON "SocialCommunicationHighlight"("militaryEmail");

-- AddForeignKey
ALTER TABLE "SocialCommunicationHighlight" ADD CONSTRAINT "SocialCommunicationHighlight_localityId_fkey" FOREIGN KEY ("localityId") REFERENCES "Locality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialCommunicationHighlight" ADD CONSTRAINT "SocialCommunicationHighlight_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
