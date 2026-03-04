-- AlterTable: Add imageData and mimeType, make fileUrl and storageKey nullable
ALTER TABLE "LibraryPhoto" ADD COLUMN "imageData" TEXT NOT NULL DEFAULT '';
ALTER TABLE "LibraryPhoto" ADD COLUMN "mimeType" TEXT;
ALTER TABLE "LibraryPhoto" ALTER COLUMN "fileUrl" DROP NOT NULL;
ALTER TABLE "LibraryPhoto" ALTER COLUMN "storageKey" DROP NOT NULL;

-- Migrate existing photos: convert fileUrl to placeholder base64 if needed
-- For now, we'll keep fileUrl for existing records and new ones will use imageData

