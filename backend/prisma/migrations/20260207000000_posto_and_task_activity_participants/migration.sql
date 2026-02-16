-- CreateTable
CREATE TABLE "Posto" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Posto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskActivityParticipant" (
    "id" TEXT NOT NULL,
    "taskInstanceId" TEXT NOT NULL,
    "postoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskActivityParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Posto_code_key" ON "Posto"("code");

-- CreateIndex
CREATE INDEX "TaskActivityParticipant_taskInstanceId_idx" ON "TaskActivityParticipant"("taskInstanceId");

-- CreateIndex
CREATE INDEX "TaskActivityParticipant_postoId_idx" ON "TaskActivityParticipant"("postoId");

-- AddForeignKey
ALTER TABLE "TaskActivityParticipant" ADD CONSTRAINT "TaskActivityParticipant_taskInstanceId_fkey" FOREIGN KEY ("taskInstanceId") REFERENCES "TaskInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskActivityParticipant" ADD CONSTRAINT "TaskActivityParticipant_postoId_fkey" FOREIGN KEY ("postoId") REFERENCES "Posto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
