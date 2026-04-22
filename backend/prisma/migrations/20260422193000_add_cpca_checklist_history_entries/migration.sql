CREATE TABLE IF NOT EXISTS "CpcaChecklistHistoryEntry" (
  "id" TEXT NOT NULL,
  "omId" TEXT NOT NULL,
  "itemKey" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL,
  "details" TEXT,
  "speakerName" TEXT,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CpcaChecklistHistoryEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CpcaChecklistHistoryEntry_omId_fkey" FOREIGN KEY ("omId") REFERENCES "Om"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CpcaChecklistHistoryEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CpcaChecklistHistoryEntry_omId_itemKey_completedAt_idx"
  ON "CpcaChecklistHistoryEntry"("omId", "itemKey", "completedAt");
CREATE INDEX IF NOT EXISTS "CpcaChecklistHistoryEntry_createdByUserId_idx"
  ON "CpcaChecklistHistoryEntry"("createdByUserId");
CREATE INDEX IF NOT EXISTS "CpcaChecklistHistoryEntry_itemKey_completedAt_idx"
  ON "CpcaChecklistHistoryEntry"("itemKey", "completedAt");

INSERT INTO "CpcaChecklistHistoryEntry" (
  "id",
  "omId",
  "itemKey",
  "completedAt",
  "details",
  "speakerName",
  "createdByUserId",
  "createdAt",
  "updatedAt"
)
SELECT
  concat('cpca_hist_', gen_random_uuid()::text),
  item."omId",
  item."itemKey",
  item."completedAt",
  item."details",
  item."speakerName",
  item."updatedByUserId",
  item."createdAt",
  item."updatedAt"
FROM "CpcaChecklistItem" item
WHERE item."isCompleted" = true
  AND item."completedAt" IS NOT NULL
  AND item."itemKey" IN (
    'PALESTRA',
    'SEMINARIO_EVENTO',
    'MATERIAIS_INFORMATIVOS',
    'COMPARTILHAMENTO_APLICATIVOS_MENSAGEM',
    'POP_US',
    'REUNIAO_APRESENTACAO_MEMBROS'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "CpcaChecklistHistoryEntry" history
    WHERE history."omId" = item."omId"
      AND history."itemKey" = item."itemKey"
      AND history."completedAt" = item."completedAt"
      AND COALESCE(history."details", '') = COALESCE(item."details", '')
      AND COALESCE(history."speakerName", '') = COALESCE(item."speakerName", '')
  );
