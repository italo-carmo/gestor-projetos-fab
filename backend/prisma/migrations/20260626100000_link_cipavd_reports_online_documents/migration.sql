ALTER TABLE "CipavdReportFile"
ADD COLUMN "onlineDocumentId" TEXT;

CREATE UNIQUE INDEX "CipavdReportFile_onlineDocumentId_key" ON "CipavdReportFile"("onlineDocumentId");

ALTER TABLE "CipavdReportFile"
ADD CONSTRAINT "CipavdReportFile_onlineDocumentId_fkey"
FOREIGN KEY ("onlineDocumentId") REFERENCES "DocumentAsset"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
