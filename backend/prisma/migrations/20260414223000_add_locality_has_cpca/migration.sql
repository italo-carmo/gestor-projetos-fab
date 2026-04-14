ALTER TABLE "Locality"
ADD COLUMN "hasCpca" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Locality" l
SET "hasCpca" = true
WHERE EXISTS (
  SELECT 1
  FROM "User" u
  JOIN "UserRole" ur ON ur."userId" = u."id"
  JOIN "Role" r ON r."id" = ur."roleId"
  WHERE u."localityId" = l."id"
    AND UPPER(BTRIM(r."name")) = 'CPCA'
);
