CREATE TABLE "BiSurveyCardSetting" (
  "id" TEXT NOT NULL,
  "cardId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BiSurveyCardSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BiDomesticViolenceCardSetting" (
  "id" TEXT NOT NULL,
  "cardId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BiDomesticViolenceCardSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BiRecruitsCardSetting" (
  "id" TEXT NOT NULL,
  "cardId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BiRecruitsCardSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BiSurveyCardSetting_cardId_key"
  ON "BiSurveyCardSetting"("cardId");

CREATE INDEX "BiSurveyCardSetting_updatedAt_idx"
  ON "BiSurveyCardSetting"("updatedAt");

CREATE UNIQUE INDEX "BiDomesticViolenceCardSetting_cardId_key"
  ON "BiDomesticViolenceCardSetting"("cardId");

CREATE INDEX "BiDomesticViolenceCardSetting_updatedAt_idx"
  ON "BiDomesticViolenceCardSetting"("updatedAt");

CREATE UNIQUE INDEX "BiRecruitsCardSetting_cardId_key"
  ON "BiRecruitsCardSetting"("cardId");

CREATE INDEX "BiRecruitsCardSetting_updatedAt_idx"
  ON "BiRecruitsCardSetting"("updatedAt");

ALTER TABLE "BiSurveyCardSetting"
  ADD CONSTRAINT "BiSurveyCardSetting_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BiDomesticViolenceCardSetting"
  ADD CONSTRAINT "BiDomesticViolenceCardSetting_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BiRecruitsCardSetting"
  ADD CONSTRAINT "BiRecruitsCardSetting_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
