-- Add tags to social communication articles for categorization and filtering
ALTER TABLE "SocialCommunicationArticle"
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
