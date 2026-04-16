CREATE TABLE "StrategicRecommendation" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "sessionId" TEXT,
  "sourceAgentType" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "focusType" TEXT,
  "focusLabel" TEXT,
  "uf" TEXT,
  "omId" TEXT,
  "evidenceJson" JSONB,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StrategicRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StrategicRecommendation_createdAt_idx" ON "StrategicRecommendation"("createdAt");
CREATE INDEX "StrategicRecommendation_createdById_idx" ON "StrategicRecommendation"("createdById");
CREATE INDEX "StrategicRecommendation_uf_idx" ON "StrategicRecommendation"("uf");
CREATE INDEX "StrategicRecommendation_omId_idx" ON "StrategicRecommendation"("omId");

ALTER TABLE "StrategicRecommendation"
ADD CONSTRAINT "StrategicRecommendation_omId_fkey"
FOREIGN KEY ("omId") REFERENCES "Om"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StrategicRecommendation"
ADD CONSTRAINT "StrategicRecommendation_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
