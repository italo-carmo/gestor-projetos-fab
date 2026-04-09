ALTER TABLE "LibraryPhoto"
  ADD COLUMN "scope" "ActivityScope" NOT NULL DEFAULT 'SMIF';

ALTER TABLE "LibraryDocument"
  ADD COLUMN "scope" "ActivityScope" NOT NULL DEFAULT 'SMIF';

UPDATE "LibraryPhoto" p
SET "scope" = COALESCE(
  (
    SELECT CASE
      WHEN l."catalogType" = 'CIPAVD' THEN 'CIPAVD'::"ActivityScope"
      ELSE 'SMIF'::"ActivityScope"
    END
    FROM "Locality" l
    WHERE l."id" = p."localityId"
  ),
  'SMIF'::"ActivityScope"
);

CREATE INDEX "LibraryPhoto_scope_sortOrder_createdAt_idx"
  ON "LibraryPhoto"("scope", "sortOrder", "createdAt");

CREATE INDEX "LibraryDocument_scope_createdAt_idx"
  ON "LibraryDocument"("scope", "createdAt");
