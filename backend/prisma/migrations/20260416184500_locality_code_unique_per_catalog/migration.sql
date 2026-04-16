DROP INDEX IF EXISTS "Locality_code_key";
CREATE UNIQUE INDEX "Locality_code_catalogType_key" ON "Locality"("code", "catalogType");
