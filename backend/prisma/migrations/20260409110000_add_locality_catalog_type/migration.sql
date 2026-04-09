-- Separate SMIF and CIPAVD locality catalogs while keeping existing locality references.
CREATE TYPE "LocalityCatalogType" AS ENUM ('SMIF', 'CIPAVD');

ALTER TABLE "Locality"
ADD COLUMN "catalogType" "LocalityCatalogType" NOT NULL DEFAULT 'SMIF';

CREATE INDEX "Locality_catalogType_idx" ON "Locality"("catalogType");
