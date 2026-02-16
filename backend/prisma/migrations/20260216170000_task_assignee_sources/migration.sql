-- Task assignee improvements: support USER/ELO/locality command assignees
CREATE TYPE "TaskAssigneeType" AS ENUM ('USER', 'ELO', 'LOCALITY_COMMAND', 'LOCALITY_COMMANDER');

ALTER TABLE "TaskInstance"
  ADD COLUMN "assignedEloId" TEXT,
  ADD COLUMN "assigneeType" "TaskAssigneeType",
  ADD COLUMN "externalAssigneeName" TEXT,
  ADD COLUMN "externalAssigneeRole" TEXT;

CREATE INDEX "TaskInstance_assignedEloId_idx" ON "TaskInstance"("assignedEloId");

ALTER TABLE "TaskInstance"
  ADD CONSTRAINT "TaskInstance_assignedEloId_fkey"
  FOREIGN KEY ("assignedEloId") REFERENCES "Elo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
