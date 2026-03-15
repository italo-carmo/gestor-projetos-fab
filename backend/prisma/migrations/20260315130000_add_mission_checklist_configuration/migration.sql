CREATE TABLE "MissionChecklistDimension" (
  "id" TEXT NOT NULL,
  "sectionId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "prompt" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MissionChecklistDimension_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MissionChecklistClassificationSetting" (
  "id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "colorHex" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MissionChecklistClassificationSetting_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MissionChecklistDimension_sectionId_isActive_sortOrder_createdAt_idx"
ON "MissionChecklistDimension"("sectionId", "isActive", "sortOrder", "createdAt");

CREATE INDEX "MissionChecklistClassificationSetting_sortOrder_createdAt_idx"
ON "MissionChecklistClassificationSetting"("sortOrder", "createdAt");

INSERT INTO "MissionChecklistClassificationSetting" ("id", "label", "colorHex", "sortOrder") VALUES
  ('FORTE_CONSOLIDADA', 'Dimensão forte/consolidada', '#2E7D32', 10),
  ('OPORTUNIDADE_MELHORIA', 'Dimensão com oportunidades de melhoria', '#F9A825', 20),
  ('NECESSITA_ANALISE', 'Dimensão necessita de maior análise', NULL, 30),
  ('POSSIVEL_RISCO', 'Possível Risco', '#C62828', 40)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "MissionChecklistDimension" ("id", "sectionId", "title", "prompt", "sortOrder") VALUES
  ('lideranca_atuacao', 'lideranca', 'Atuação de lideranças', NULL, 10),
  ('lideranca_coesao_equipe', 'lideranca', 'Coesão da equipe de instrução e inclusão de instrutoras do sexo feminino', NULL, 20),
  ('lideranca_preparo_instrutoras', 'lideranca', 'Preparo das instrutoras mulheres', NULL, 30),
  ('acompanhamento_motivacao', 'acompanhamento_recrutas', 'Percepção de motivação das recrutas', NULL, 10),
  ('acompanhamento_suporte_psicossocial', 'acompanhamento_recrutas', 'Suporte psicossocial (psicólogo, assistente social e jurídico)', NULL, 20),
  ('acompanhamento_engajamento_familiar', 'acompanhamento_recrutas', 'Engajamento familiar', NULL, 30),
  ('acompanhamento_infraestrutura', 'acompanhamento_recrutas', 'Infraestrutura e condições', NULL, 40),
  ('riscos_reputacional_juridico', 'analise_riscos', 'Avaliação do risco reputacional e jurídico para a equipe de instrução', 'Existe clareza sobre os limites da atuação dos instrutores? A equipe compreende que determinadas condutas, mesmo sem intenção, podem configurar assédio?', 10),
  ('riscos_subnotificacao', 'analise_riscos', 'Risco de subnotificação: ambiente que inibe denúncias', 'O ambiente de instrução é percebido pelas recrutas como seguro para denunciar? Há sinais de que denúncias são desencorajadas, minimizadas ou expostas?', 20),
  ('riscos_tratamento_desigual', 'analise_riscos', 'Risco de tratamento desigual percebido como discriminação', 'As diferenças de tratamento entre recrutas masculinos e femininos são explicadas institucionalmente? Há risco de que sejam lidas como privilégio ou discriminação por qualquer das partes?', 30),
  ('riscos_abertura_mudancas', 'analise_riscos', 'Abertura para mudanças e adaptações do processo', 'A liderança demonstra flexibilidade para ajustar práticas com base nos aprendizados do SMIF?', 40),
  ('riscos_participacao_boas_praticas', 'analise_riscos', 'Participação ativa no ciclo de boas práticas', 'A equipe engajou com qualidade nas atividades propostas? Trouxe reflexões genuínas?', 50),
  ('riscos_valorizacao_presenca_feminina', 'analise_riscos', 'Valorização da presença feminina na instrução e na formação', 'Há reconhecimento genuíno, e não apenas formal, da importância deste momento histórico?', 60)
ON CONFLICT ("id") DO NOTHING;
