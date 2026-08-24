ALTER TABLE "CpcComplaintCase"
ADD COLUMN "processOpened" BOOLEAN,
ADD COLUMN "processNotOpenedReason" TEXT;

UPDATE "CpcComplaintCase"
SET "processOpened" = TRUE
WHERE "procedureType" <> 'NOT_DEFINED';
