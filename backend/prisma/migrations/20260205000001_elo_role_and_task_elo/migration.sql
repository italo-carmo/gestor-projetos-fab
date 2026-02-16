-- CreateTable EloRole (tipos de elo gerenciáveis pelo Admin)
CREATE TABLE "EloRole" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EloRole_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EloRole_code_key" ON "EloRole"("code");

-- Seed EloRole com os valores do enum antigo
INSERT INTO "EloRole" ("id", "code", "name", "sortOrder", "createdAt", "updatedAt")
VALUES
  (concat('elorole_', gen_random_uuid()::text), 'PSICOLOGIA', 'Psicologia', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('elorole_', gen_random_uuid()::text), 'SSO', 'SSO', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('elorole_', gen_random_uuid()::text), 'JURIDICO', 'Jurídico', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('elorole_', gen_random_uuid()::text), 'CPCA', 'CPCA', 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('elorole_', gen_random_uuid()::text), 'GRAD_MASTER', 'Graduado Master', 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Elo: add eloRoleId (nullable first)
ALTER TABLE "Elo" ADD COLUMN "eloRoleId" TEXT;

-- Backfill: set eloRoleId from roleType
UPDATE "Elo" e
SET "eloRoleId" = r.id
FROM "EloRole" r
WHERE r.code = e."roleType"::text;

-- Make eloRoleId NOT NULL and drop roleType
ALTER TABLE "Elo" ALTER COLUMN "eloRoleId" SET NOT NULL;
ALTER TABLE "Elo" DROP COLUMN "roleType";

-- AddForeignKey Elo.eloRoleId -> EloRole
ALTER TABLE "Elo" ADD CONSTRAINT "Elo_eloRoleId_fkey" FOREIGN KEY ("eloRoleId") REFERENCES "EloRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Elo_localityId_eloRoleId_idx" ON "Elo"("localityId", "eloRoleId");

-- TaskTemplate: add eloRoleId (optional)
ALTER TABLE "TaskTemplate" ADD COLUMN "eloRoleId" TEXT;
ALTER TABLE "TaskTemplate" ADD CONSTRAINT "TaskTemplate_eloRoleId_fkey" FOREIGN KEY ("eloRoleId") REFERENCES "EloRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- TaskInstance: add eloRoleId (optional)
ALTER TABLE "TaskInstance" ADD COLUMN "eloRoleId" TEXT;
ALTER TABLE "TaskInstance" ADD CONSTRAINT "TaskInstance_eloRoleId_fkey" FOREIGN KEY ("eloRoleId") REFERENCES "EloRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "TaskInstance_eloRoleId_idx" ON "TaskInstance"("eloRoleId");

-- Drop enum EloRoleType
DROP TYPE "EloRoleType";
