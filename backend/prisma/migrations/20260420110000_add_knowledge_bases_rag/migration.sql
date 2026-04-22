CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE "KnowledgeBaseTheme" AS ENUM ('CIPAVD', 'SMIF', 'CPCA', 'SHARED');
CREATE TYPE "KnowledgeBaseDocumentStatus" AS ENUM ('PENDING', 'INDEXING', 'READY', 'FAILED');

CREATE TABLE "KnowledgeBase" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "theme" "KnowledgeBaseTheme" NOT NULL DEFAULT 'SHARED',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeBase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeBaseDocument" (
    "id" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "storageKey" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "checksum" TEXT,
    "status" "KnowledgeBaseDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "contentText" TEXT,
    "parsedAt" TIMESTAMP(3),
    "lastIndexedAt" TIMESTAMP(3),
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "indexError" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeBaseDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeBaseChunk" (
    "id" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "textContent" TEXT NOT NULL,
    "tokenCount" INTEGER,
    "metadataJson" JSONB,
    "embedding" vector,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeBaseChunk_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KnowledgeBase_key_key" ON "KnowledgeBase"("key");
CREATE INDEX "KnowledgeBase_theme_isActive_sortOrder_createdAt_idx" ON "KnowledgeBase"("theme", "isActive", "sortOrder", "createdAt");
CREATE INDEX "KnowledgeBase_isActive_sortOrder_createdAt_idx" ON "KnowledgeBase"("isActive", "sortOrder", "createdAt");

CREATE INDEX "KnowledgeBaseDocument_knowledgeBaseId_status_createdAt_idx" ON "KnowledgeBaseDocument"("knowledgeBaseId", "status", "createdAt");
CREATE INDEX "KnowledgeBaseDocument_status_lastIndexedAt_idx" ON "KnowledgeBaseDocument"("status", "lastIndexedAt");

CREATE UNIQUE INDEX "KnowledgeBaseChunk_documentId_chunkIndex_key" ON "KnowledgeBaseChunk"("documentId", "chunkIndex");
CREATE INDEX "KnowledgeBaseChunk_knowledgeBaseId_documentId_idx" ON "KnowledgeBaseChunk"("knowledgeBaseId", "documentId");
CREATE INDEX "KnowledgeBaseChunk_documentId_idx" ON "KnowledgeBaseChunk"("documentId");
CREATE INDEX "KnowledgeBaseChunk_textSearch_idx" ON "KnowledgeBaseChunk" USING GIN (to_tsvector('portuguese', coalesce("textContent", '')));

ALTER TABLE "KnowledgeBaseDocument"
ADD CONSTRAINT "KnowledgeBaseDocument_knowledgeBaseId_fkey"
FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KnowledgeBaseChunk"
ADD CONSTRAINT "KnowledgeBaseChunk_knowledgeBaseId_fkey"
FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KnowledgeBaseChunk"
ADD CONSTRAINT "KnowledgeBaseChunk_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "KnowledgeBaseDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
