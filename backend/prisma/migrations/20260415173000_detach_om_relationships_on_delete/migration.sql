-- Allow OM-linked records to be detached instead of deleted when an OM is removed

ALTER TABLE "CpcaCommissionPresident"
  ALTER COLUMN "omId" DROP NOT NULL;

ALTER TABLE "CpcaCommissionMember"
  ALTER COLUMN "omId" DROP NOT NULL;

ALTER TABLE "CpcaPresidentSelfRegistration"
  ALTER COLUMN "omId" DROP NOT NULL;

ALTER TABLE "User"
  DROP CONSTRAINT IF EXISTS "User_omId_fkey";

ALTER TABLE "User"
  ADD CONSTRAINT "User_omId_fkey"
  FOREIGN KEY ("omId") REFERENCES "Om"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CpcComplaintCase"
  DROP CONSTRAINT IF EXISTS "CpcComplaintCase_omId_fkey";

ALTER TABLE "CpcComplaintCase"
  ADD CONSTRAINT "CpcComplaintCase_omId_fkey"
  FOREIGN KEY ("omId") REFERENCES "Om"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CpcaCommissionPresident"
  DROP CONSTRAINT IF EXISTS "CpcaCommissionPresident_omId_fkey";

ALTER TABLE "CpcaCommissionPresident"
  ADD CONSTRAINT "CpcaCommissionPresident_omId_fkey"
  FOREIGN KEY ("omId") REFERENCES "Om"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CpcaCommissionMember"
  DROP CONSTRAINT IF EXISTS "CpcaCommissionMember_omId_fkey";

ALTER TABLE "CpcaCommissionMember"
  ADD CONSTRAINT "CpcaCommissionMember_omId_fkey"
  FOREIGN KEY ("omId") REFERENCES "Om"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CpcaPresidentSelfRegistration"
  DROP CONSTRAINT IF EXISTS "CpcaPresidentSelfRegistration_omId_fkey";

ALTER TABLE "CpcaPresidentSelfRegistration"
  ADD CONSTRAINT "CpcaPresidentSelfRegistration_omId_fkey"
  FOREIGN KEY ("omId") REFERENCES "Om"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
