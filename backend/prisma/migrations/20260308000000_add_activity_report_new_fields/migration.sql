-- Add new fields to ActivityReport for structured report sections
ALTER TABLE "ActivityReport" ADD COLUMN IF NOT EXISTS "participantsMaleCount" INTEGER;
ALTER TABLE "ActivityReport" ADD COLUMN IF NOT EXISTS "participantsFemaleCount" INTEGER;
ALTER TABLE "ActivityReport" ADD COLUMN IF NOT EXISTS "publicProfile" TEXT;
ALTER TABLE "ActivityReport" ADD COLUMN IF NOT EXISTS "mainPointsObserved" TEXT;
ALTER TABLE "ActivityReport" ADD COLUMN IF NOT EXISTS "attentionPoints" TEXT;
ALTER TABLE "ActivityReport" ADD COLUMN IF NOT EXISTS "nextSteps" TEXT;
ALTER TABLE "ActivityReport" ADD COLUMN IF NOT EXISTS "referencesAndAttachments" TEXT;

