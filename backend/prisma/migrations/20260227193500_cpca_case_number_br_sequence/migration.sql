-- Ajuste solicitado: tornar o caso legado CPCA-2026-BR-53104454 como 00001
-- e normalizar a sequência BR/2026 para formato incremental de 5 dígitos.
WITH scoped AS (
  SELECT
    c."id",
    row_number() OVER (
      ORDER BY
        CASE WHEN c."caseNumber" = 'CPCA-2026-BR-53104454' THEN 0 ELSE 1 END,
        c."reportedAt" ASC,
        c."createdAt" ASC,
        c."id" ASC
    ) AS seq
  FROM "CpcComplaintCase" c
  INNER JOIN "Locality" l
    ON l."id" = c."localityId"
  WHERE l."code" = 'BR'
    AND c."caseNumber" LIKE 'CPCA-2026-BR-%'
),
tmp_update AS (
  UPDATE "CpcComplaintCase" c
  SET "caseNumber" = CONCAT('TMP-CPCA-', c."id")
  FROM scoped s
  WHERE c."id" = s."id"
  RETURNING c."id"
)
UPDATE "CpcComplaintCase" c
SET "caseNumber" = CONCAT('CPCA-2026-BR-', LPAD(s.seq::text, 5, '0'))
FROM scoped s
WHERE c."id" = s."id";
