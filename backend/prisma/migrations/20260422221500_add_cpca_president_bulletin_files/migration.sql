ALTER TABLE "CpcaCommissionPresident"
ADD COLUMN "designationBulletinFileName" TEXT,
ADD COLUMN "designationBulletinStorageKey" TEXT,
ADD COLUMN "designationBulletinMimeType" TEXT,
ADD COLUMN "designationBulletinFileSize" INTEGER,
ADD COLUMN "designationBulletinChecksum" TEXT;

ALTER TABLE "CpcaPresidentSelfRegistration"
ADD COLUMN "bulletinFileName" TEXT,
ADD COLUMN "bulletinStorageKey" TEXT,
ADD COLUMN "bulletinMimeType" TEXT,
ADD COLUMN "bulletinFileSize" INTEGER,
ADD COLUMN "bulletinChecksum" TEXT;
