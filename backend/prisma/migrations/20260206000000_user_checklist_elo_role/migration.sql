-- User: add eloRoleId (responsável por este elo a nível Brasil)
ALTER TABLE "User" ADD COLUMN "eloRoleId" TEXT;
ALTER TABLE "User" ADD CONSTRAINT "User_eloRoleId_fkey" FOREIGN KEY ("eloRoleId") REFERENCES "EloRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Checklist: add eloRoleId (elo responsável por acompanhar este checklist)
ALTER TABLE "Checklist" ADD COLUMN "eloRoleId" TEXT;
ALTER TABLE "Checklist" ADD CONSTRAINT "Checklist_eloRoleId_fkey" FOREIGN KEY ("eloRoleId") REFERENCES "EloRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;
