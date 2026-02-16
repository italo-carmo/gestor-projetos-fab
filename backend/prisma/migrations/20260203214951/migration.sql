-- DropForeignKey
ALTER TABLE "ChecklistItemStatus" DROP CONSTRAINT "ChecklistItemStatus_localityId_fkey";

-- DropForeignKey
ALTER TABLE "Elo" DROP CONSTRAINT "Elo_localityId_fkey";

-- AddForeignKey
ALTER TABLE "ChecklistItemStatus" ADD CONSTRAINT "ChecklistItemStatus_localityId_fkey" FOREIGN KEY ("localityId") REFERENCES "Locality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Elo" ADD CONSTRAINT "Elo_localityId_fkey" FOREIGN KEY ("localityId") REFERENCES "Locality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
