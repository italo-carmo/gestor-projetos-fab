ALTER TABLE "CpcComplaintCase"
ADD COLUMN "subsequentProcedureOpened" BOOLEAN,
ADD COLUMN "subsequentProcedureNotOpenedReason" TEXT,
ADD COLUMN "subsequentProcedureType" "CpcProcedureType",
ADD COLUMN "subsequentProcedureStatus" "CpcComplaintStatus",
ADD COLUMN "subsequentProcedureReference" TEXT,
ADD COLUMN "subsequentProcedureCurrentSituation" TEXT,
ADD COLUMN "subsequentProcedureStartDate" TIMESTAMP(3),
ADD COLUMN "subsequentProcedureEndDate" TIMESTAMP(3);
