-- Add textColorHex to LessonLearnedType
ALTER TABLE "LessonLearnedType" ADD COLUMN IF NOT EXISTS "textColorHex" TEXT DEFAULT '#FFFFFF';

-- Add audience enum and field to SocialCommunicationArticle
DO $$ BEGIN
  CREATE TYPE "SocialCommunicationAudience" AS ENUM ('INTERNAL', 'EXTERNAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
ALTER TABLE "SocialCommunicationArticle" ADD COLUMN IF NOT EXISTS "audience" "SocialCommunicationAudience" NOT NULL DEFAULT 'INTERNAL';
CREATE INDEX IF NOT EXISTS "SocialCommunicationArticle_audience_idx" ON "SocialCommunicationArticle"("audience");
