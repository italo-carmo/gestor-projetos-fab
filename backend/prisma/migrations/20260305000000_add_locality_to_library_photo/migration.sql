-- AlterTable
ALTER TABLE "LibraryPhoto" ADD COLUMN "localityId" TEXT;

-- CreateIndex
CREATE INDEX "LibraryPhoto_localityId_idx" ON "LibraryPhoto"("localityId");

-- AddForeignKey
ALTER TABLE "LibraryPhoto" ADD CONSTRAINT "LibraryPhoto_localityId_fkey" FOREIGN KEY ("localityId") REFERENCES "Locality"("id") ON DELETE SET NULL ON UPDATE CASCADE;

