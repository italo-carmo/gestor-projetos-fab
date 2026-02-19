ALTER TABLE "User" ADD COLUMN "ldapUid" TEXT;
CREATE UNIQUE INDEX "User_ldapUid_key" ON "User"("ldapUid");
