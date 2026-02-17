-- AlterTable
ALTER TABLE "DocumentAsset"
ADD COLUMN "subcategoryId" TEXT;

-- CreateTable
CREATE TABLE "DocumentSubcategory" (
    "id" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentSubcategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentSubcategory_category_name_key" ON "DocumentSubcategory"("category", "name");

-- CreateIndex
CREATE INDEX "DocumentSubcategory_category_createdAt_idx" ON "DocumentSubcategory"("category", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentAsset_category_subcategoryId_createdAt_idx" ON "DocumentAsset"("category", "subcategoryId", "createdAt");

-- AddForeignKey
ALTER TABLE "DocumentAsset"
ADD CONSTRAINT "DocumentAsset_subcategoryId_fkey"
FOREIGN KEY ("subcategoryId") REFERENCES "DocumentSubcategory"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
