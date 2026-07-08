ALTER TABLE "MissionReport"
ADD COLUMN "blocksJson" JSONB;

CREATE TABLE "MissionReportMigrationBackup" (
  "id" TEXT NOT NULL,
  "missionReportId" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "contentHtml" TEXT NOT NULL,
  "contentText" TEXT NOT NULL,
  "contentHtmlMd5" TEXT NOT NULL,
  "contentTextMd5" TEXT NOT NULL,
  "migrationName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MissionReportMigrationBackup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MissionReportMigrationBackup_missionReportId_migrationName_key"
ON "MissionReportMigrationBackup"("missionReportId", "migrationName");

CREATE INDEX "MissionReportMigrationBackup_missionId_idx"
ON "MissionReportMigrationBackup"("missionId");

CREATE INDEX "MissionReportMigrationBackup_createdAt_idx"
ON "MissionReportMigrationBackup"("createdAt");

ALTER TABLE "MissionReportMigrationBackup"
ADD CONSTRAINT "MissionReportMigrationBackup_missionReportId_fkey"
FOREIGN KEY ("missionReportId") REFERENCES "MissionReport"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "MissionReportMigrationBackup" (
  "id",
  "missionReportId",
  "missionId",
  "contentHtml",
  "contentText",
  "contentHtmlMd5",
  "contentTextMd5",
  "migrationName"
)
SELECT
  'mrb_' || md5("id" || ':20260708120000_mission_report_blocks'),
  "id",
  "missionId",
  "contentHtml",
  "contentText",
  md5("contentHtml"),
  md5("contentText"),
  '20260708120000_mission_report_blocks'
FROM "MissionReport"
ON CONFLICT ("missionReportId", "migrationName") DO NOTHING;

UPDATE "MissionReport"
SET "blocksJson" = jsonb_build_object(
  'version', 1,
  'blocks', jsonb_build_array(
    jsonb_build_object(
      'id', 'legacy-' || "id",
      'type', 'free_text',
      'contentHtml', "contentHtml",
      'contentText', "contentText",
      'createdFrom', 'legacy_content',
      'sortOrder', 0
    )
  )
)
WHERE "blocksJson" IS NULL
  AND (COALESCE("contentHtml", '') <> '' OR COALESCE("contentText", '') <> '');
