-- Commission seniority ordering for CIPAVD org chart
ALTER TABLE "User"
  ADD COLUMN "commissionSeniority" INTEGER;

CREATE INDEX "User_commissionSeniority_idx" ON "User"("commissionSeniority");
