CREATE TABLE "DocumentOnlinePresence" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "color" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentOnlinePresence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentOnlinePresence_documentId_sessionId_key" ON "DocumentOnlinePresence"("documentId", "sessionId");
CREATE INDEX "DocumentOnlinePresence_documentId_lastSeenAt_idx" ON "DocumentOnlinePresence"("documentId", "lastSeenAt");
CREATE INDEX "DocumentOnlinePresence_lastSeenAt_idx" ON "DocumentOnlinePresence"("lastSeenAt");

ALTER TABLE "DocumentOnlinePresence"
ADD CONSTRAINT "DocumentOnlinePresence_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "DocumentAsset"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
