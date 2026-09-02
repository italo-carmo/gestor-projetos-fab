ALTER TABLE "CpcComplaintCase"
ADD COLUMN "victimInformedOfOutcome" BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN "accusedInformedOfOutcome" BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE "CpcComplaintCase"
SET "victimInformedOfOutcome" = TRUE
WHERE "victimFeedbackDate" IS NOT NULL
   OR ("victimIsNotifier" = TRUE AND "notifierFeedbackDate" IS NOT NULL);
