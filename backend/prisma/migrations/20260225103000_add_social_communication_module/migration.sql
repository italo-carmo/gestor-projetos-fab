-- Social communication module: article cards with external source URL

CREATE TABLE "SocialCommunicationArticle" (
  "id" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "coverImageUrl" TEXT,
  "summary" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialCommunicationArticle_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SocialCommunicationArticle_createdAt_idx" ON "SocialCommunicationArticle"("createdAt");
CREATE INDEX "SocialCommunicationArticle_publishedAt_idx" ON "SocialCommunicationArticle"("publishedAt");

ALTER TABLE "SocialCommunicationArticle"
  ADD CONSTRAINT "SocialCommunicationArticle_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
