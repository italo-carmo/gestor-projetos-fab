-- Comments timeline for tasks and activities + per-user read tracking

CREATE TABLE "TaskComment" (
  "id" TEXT NOT NULL,
  "taskInstanceId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskCommentRead" (
  "id" TEXT NOT NULL,
  "taskInstanceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaskCommentRead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActivityComment" (
  "id" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActivityCommentRead" (
  "id" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActivityCommentRead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaskComment_taskInstanceId_createdAt_idx" ON "TaskComment"("taskInstanceId", "createdAt");
CREATE INDEX "TaskComment_authorId_idx" ON "TaskComment"("authorId");

CREATE UNIQUE INDEX "TaskCommentRead_taskInstanceId_userId_key" ON "TaskCommentRead"("taskInstanceId", "userId");
CREATE INDEX "TaskCommentRead_userId_seenAt_idx" ON "TaskCommentRead"("userId", "seenAt");

CREATE INDEX "ActivityComment_activityId_createdAt_idx" ON "ActivityComment"("activityId", "createdAt");
CREATE INDEX "ActivityComment_authorId_idx" ON "ActivityComment"("authorId");

CREATE UNIQUE INDEX "ActivityCommentRead_activityId_userId_key" ON "ActivityCommentRead"("activityId", "userId");
CREATE INDEX "ActivityCommentRead_userId_seenAt_idx" ON "ActivityCommentRead"("userId", "seenAt");

ALTER TABLE "TaskComment"
  ADD CONSTRAINT "TaskComment_taskInstanceId_fkey"
  FOREIGN KEY ("taskInstanceId") REFERENCES "TaskInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskComment"
  ADD CONSTRAINT "TaskComment_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskCommentRead"
  ADD CONSTRAINT "TaskCommentRead_taskInstanceId_fkey"
  FOREIGN KEY ("taskInstanceId") REFERENCES "TaskInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskCommentRead"
  ADD CONSTRAINT "TaskCommentRead_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActivityComment"
  ADD CONSTRAINT "ActivityComment_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActivityComment"
  ADD CONSTRAINT "ActivityComment_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActivityCommentRead"
  ADD CONSTRAINT "ActivityCommentRead_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActivityCommentRead"
  ADD CONSTRAINT "ActivityCommentRead_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
