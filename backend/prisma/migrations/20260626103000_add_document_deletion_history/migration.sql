ALTER TABLE "DocumentAsset"
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedById" TEXT;

CREATE INDEX "DocumentAsset_deletedAt_idx" ON "DocumentAsset"("deletedAt");
CREATE INDEX "DocumentAsset_deletedById_idx" ON "DocumentAsset"("deletedById");

ALTER TABLE "DocumentAsset"
ADD CONSTRAINT "DocumentAsset_deletedById_fkey"
FOREIGN KEY ("deletedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
