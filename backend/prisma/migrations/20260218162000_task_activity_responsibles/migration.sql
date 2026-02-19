-- Task multi-responsibles
CREATE TABLE "TaskResponsible" (
  "id" TEXT NOT NULL,
  "taskInstanceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "assignedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskResponsible_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaskResponsible_taskInstanceId_userId_key" ON "TaskResponsible"("taskInstanceId", "userId");
CREATE INDEX "TaskResponsible_taskInstanceId_createdAt_idx" ON "TaskResponsible"("taskInstanceId", "createdAt");
CREATE INDEX "TaskResponsible_userId_idx" ON "TaskResponsible"("userId");

ALTER TABLE "TaskResponsible"
  ADD CONSTRAINT "TaskResponsible_taskInstanceId_fkey"
  FOREIGN KEY ("taskInstanceId") REFERENCES "TaskInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskResponsible"
  ADD CONSTRAINT "TaskResponsible_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskResponsible"
  ADD CONSTRAINT "TaskResponsible_assignedById_fkey"
  FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill from legacy single responsible field
INSERT INTO "TaskResponsible" ("id", "taskInstanceId", "userId", "createdAt")
SELECT concat('taskresp_', gen_random_uuid()::text), t."id", t."assignedToId", CURRENT_TIMESTAMP
FROM "TaskInstance" t
WHERE t."assignedToId" IS NOT NULL
ON CONFLICT ("taskInstanceId", "userId") DO NOTHING;

-- Activity multi-responsibles
CREATE TABLE "ActivityResponsible" (
  "id" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "assignedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityResponsible_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActivityResponsible_activityId_userId_key" ON "ActivityResponsible"("activityId", "userId");
CREATE INDEX "ActivityResponsible_activityId_createdAt_idx" ON "ActivityResponsible"("activityId", "createdAt");
CREATE INDEX "ActivityResponsible_userId_idx" ON "ActivityResponsible"("userId");

ALTER TABLE "ActivityResponsible"
  ADD CONSTRAINT "ActivityResponsible_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActivityResponsible"
  ADD CONSTRAINT "ActivityResponsible_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActivityResponsible"
  ADD CONSTRAINT "ActivityResponsible_assignedById_fkey"
  FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill from creator as default responsible when available
INSERT INTO "ActivityResponsible" ("id", "activityId", "userId", "createdAt")
SELECT concat('actresp_', gen_random_uuid()::text), a."id", a."createdById", CURRENT_TIMESTAMP
FROM "Activity" a
WHERE a."createdById" IS NOT NULL
ON CONFLICT ("activityId", "userId") DO NOTHING;
