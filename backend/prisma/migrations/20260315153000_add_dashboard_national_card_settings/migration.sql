CREATE TABLE "DashboardNationalCardSetting" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "backgroundColor" TEXT NOT NULL,
  "textColor" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DashboardNationalCardSetting_pkey" PRIMARY KEY ("id")
);

INSERT INTO "DashboardNationalCardSetting" (
  "id",
  "title",
  "description",
  "backgroundColor",
  "textColor"
) VALUES
  (
    'smif-completed',
    'Entregas Realizadas',
    'Resumo de atuação da CIPAVD.',
    '#1F4A61',
    '#F4FAFD'
  ),
  (
    'smif-field',
    'Atividades de campo realizadas pela CIPAVD.',
    'Apoio realizado pela área técnica dos integrantes.',
    '#2F6F8A',
    '#F2FBFE'
  ),
  (
    'smif-participants',
    'Público alcançado',
    'Total de participações em atividades de campo.',
    '#3A7A9A',
    '#F0F9FC'
  )
ON CONFLICT ("id") DO NOTHING;
