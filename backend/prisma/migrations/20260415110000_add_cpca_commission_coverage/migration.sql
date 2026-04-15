CREATE TABLE "CpcaCommissionCoverage" (
  "id" TEXT NOT NULL,
  "managerLocalityId" TEXT NOT NULL,
  "managedLocalityId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CpcaCommissionCoverage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CpcaCommissionCoverage_managerLocalityId_managedLocalityId_key"
ON "CpcaCommissionCoverage"("managerLocalityId", "managedLocalityId");

CREATE INDEX "CpcaCommissionCoverage_managerLocalityId_idx"
ON "CpcaCommissionCoverage"("managerLocalityId");

CREATE INDEX "CpcaCommissionCoverage_managedLocalityId_idx"
ON "CpcaCommissionCoverage"("managedLocalityId");

ALTER TABLE "CpcaCommissionCoverage"
ADD CONSTRAINT "CpcaCommissionCoverage_managerLocalityId_fkey"
FOREIGN KEY ("managerLocalityId") REFERENCES "Locality"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CpcaCommissionCoverage"
ADD CONSTRAINT "CpcaCommissionCoverage_managedLocalityId_fkey"
FOREIGN KEY ("managedLocalityId") REFERENCES "Locality"("id") ON DELETE CASCADE ON UPDATE CASCADE;
