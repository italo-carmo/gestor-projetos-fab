-- AlterTable
ALTER TABLE "DocumentSubcategory"
ADD COLUMN "parentId" TEXT;

-- DropIndex
DROP INDEX "DocumentSubcategory_category_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "DocumentSubcategory_category_parentId_name_key"
ON "DocumentSubcategory"("category", "parentId", "name");

-- CreateIndex
CREATE INDEX "DocumentSubcategory_category_parentId_createdAt_idx"
ON "DocumentSubcategory"("category", "parentId", "createdAt");

-- AddForeignKey
ALTER TABLE "DocumentSubcategory"
ADD CONSTRAINT "DocumentSubcategory_parentId_fkey"
FOREIGN KEY ("parentId") REFERENCES "DocumentSubcategory"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
