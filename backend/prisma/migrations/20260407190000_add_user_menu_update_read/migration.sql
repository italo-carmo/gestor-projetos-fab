CREATE TABLE "UserMenuUpdateRead" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "menuKey" TEXT NOT NULL,
  "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserMenuUpdateRead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserMenuUpdateRead_userId_menuKey_key"
  ON "UserMenuUpdateRead"("userId", "menuKey");

CREATE INDEX "UserMenuUpdateRead_userId_seenAt_idx"
  ON "UserMenuUpdateRead"("userId", "seenAt");

CREATE INDEX "UserMenuUpdateRead_menuKey_idx"
  ON "UserMenuUpdateRead"("menuKey");

ALTER TABLE "UserMenuUpdateRead"
  ADD CONSTRAINT "UserMenuUpdateRead_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
