-- CreateTable
CREATE TABLE "UserModuleAccessOverride" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserModuleAccessOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserModuleAccessOverride_userId_resource_key" ON "UserModuleAccessOverride"("userId", "resource");

-- CreateIndex
CREATE INDEX "UserModuleAccessOverride_userId_idx" ON "UserModuleAccessOverride"("userId");

-- CreateIndex
CREATE INDEX "UserModuleAccessOverride_resource_idx" ON "UserModuleAccessOverride"("resource");

-- AddForeignKey
ALTER TABLE "UserModuleAccessOverride"
ADD CONSTRAINT "UserModuleAccessOverride_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
