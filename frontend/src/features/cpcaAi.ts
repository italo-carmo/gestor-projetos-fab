import type {
  AdminKnowledgeBase,
  AiKnowledgeSourceId,
  AiProfileFeatureId,
} from "../api/hooks";

export const CPCA_AI_PROFILE = "cpca_agent" as const;

export const CPCA_AI_QUICK_PROMPTS = [
  "Liste as principais inconsistências cadastrais e normativas nos acolhimentos CPCA.",
  "Monte um briefing executivo dos acolhimentos CPCA abertos, com prioridades por OM.",
  "Crie um relatório analítico dos acolhimentos CPCA com base nos casos e nas bases de conhecimento selecionadas.",
  "Aponte gargalos de workflow e riscos institucionais nos acolhimentos CPCA.",
] as const;

const SOURCE_LABELS: Record<AiKnowledgeSourceId, string> = {
  missions: "Missões",
  activities_smif: "Atividades SMIF",
  activities_cipavd: "Atividades CIPAVD",
  activity_reports: "Relatórios de campo",
  best_practices: "Boas práticas",
  tasks: "Tarefas",
  survey_schools: "Pesquisa escolas",
  survey_domestic_violence: "Pesquisa violência doméstica",
  survey_recruits: "Pesquisa recrutas",
  survey_best_practice_cycle: "Pesquisa ciclo de boas práticas",
  survey_cpca_meeting: "Pesquisa encontro CPCA",
  survey_gsd_evaluation: "Pesquisa avaliação GSD",
  complaints_cpca: "Acolhimentos CPCA",
  complaints_smif: "Acolhimentos SMIF",
};

const FEATURE_LABELS: Record<AiProfileFeatureId, string> = {
  structured_situational: "Panorama situacional",
  structured_complaints: "Perfis de acolhimentos",
  structured_text: "Sinais textuais",
  structured_geo: "Recorte geográfico",
  rag_knowledge_bases: "RAG documental",
  traceability_links: "Rastreabilidade",
  suggested_links: "Links sugeridos",
  suggested_actions: "Ações sugeridas",
  cpca_case_inconsistencies: "Inconsistências CPCA",
  comgep_room: "Sala COMGEP",
};

export function buildCpcaAiScopeSummary(args: {
  sourceIds: AiKnowledgeSourceId[];
  featureIds: AiProfileFeatureId[];
  knowledgeBaseIds: string[];
  knowledgeBases: AdminKnowledgeBase[];
}) {
  const sourceLabels = args.sourceIds
    .map((id) => SOURCE_LABELS[id])
    .filter(Boolean);
  const featureLabels = args.featureIds
    .map((id) => FEATURE_LABELS[id])
    .filter(Boolean);
  const knowledgeBaseLabels = args.knowledgeBaseIds
    .map((id) => args.knowledgeBases.find((item) => item.id === id)?.name ?? "")
    .filter(Boolean);

  return {
    sourceLabels,
    featureLabels,
    knowledgeBaseLabels,
    counts: {
      sources: sourceLabels.length,
      features: featureLabels.length,
      knowledgeBases: knowledgeBaseLabels.length,
    },
  };
}

export function getCpcaAiReportFileName(dateIso?: string) {
  const date =
    String(dateIso ?? "").trim().slice(0, 10) ||
    new Date().toISOString().slice(0, 10);
  return `ia-cpca-${date}.pdf`;
}
