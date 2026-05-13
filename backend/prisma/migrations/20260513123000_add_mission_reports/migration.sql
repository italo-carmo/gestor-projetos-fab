CREATE TABLE "MissionReport" (
  "id" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "contentHtml" TEXT NOT NULL DEFAULT '',
  "contentText" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MissionReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MissionReportSignature" (
  "id" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "signedById" TEXT,
  "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt" TIMESTAMP(3),
  "removedById" TEXT,
  "signaturePayloadHash" TEXT NOT NULL,
  "signatureHash" TEXT NOT NULL,
  "signatureAlgorithm" TEXT NOT NULL DEFAULT 'HMAC-SHA256',
  "signatureVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MissionReportSignature_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MissionReport_missionId_key" ON "MissionReport"("missionId");
CREATE INDEX "MissionReport_updatedAt_idx" ON "MissionReport"("updatedAt");
CREATE INDEX "MissionReportSignature_reportId_signedAt_idx" ON "MissionReportSignature"("reportId", "signedAt");
CREATE INDEX "MissionReportSignature_signedById_idx" ON "MissionReportSignature"("signedById");
CREATE INDEX "MissionReportSignature_removedById_idx" ON "MissionReportSignature"("removedById");

ALTER TABLE "MissionReport"
  ADD CONSTRAINT "MissionReport_missionId_fkey"
  FOREIGN KEY ("missionId") REFERENCES "Mission"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MissionReportSignature"
  ADD CONSTRAINT "MissionReportSignature_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "MissionReport"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MissionReportSignature"
  ADD CONSTRAINT "MissionReportSignature_signedById_fkey"
  FOREIGN KEY ("signedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MissionReportSignature"
  ADD CONSTRAINT "MissionReportSignature_removedById_fkey"
  FOREIGN KEY ("removedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
