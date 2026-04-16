export const AI_ANALYSIS_TYPES = [
  'executive',
  'situational',
  'aggressor',
  'text',
  'geo',
  'chatbot',
  'briefing_comgep',
  'priorizacao_intervencao',
  'governanca_cpca',
] as const;

export type AiAnalysisType = (typeof AI_ANALYSIS_TYPES)[number];

export const AI_KNOWLEDGE_SOURCE_IDS = {
  MISSIONS: 'missions',
  ACTIVITIES_SMIF: 'activities_smif',
  ACTIVITIES_CIPAVD: 'activities_cipavd',
  ACTIVITY_REPORTS: 'activity_reports',
  BEST_PRACTICES: 'best_practices',
  TASKS: 'tasks',
  SURVEY_SCHOOLS: 'survey_schools',
  SURVEY_DOMESTIC_VIOLENCE: 'survey_domestic_violence',
  SURVEY_RECRUITS: 'survey_recruits',
  SURVEY_BEST_PRACTICE_CYCLE: 'survey_best_practice_cycle',
  SURVEY_CPCA_MEETING: 'survey_cpca_meeting',
  SURVEY_GSD_EVALUATION: 'survey_gsd_evaluation',
  COMPLAINTS_CPCA: 'complaints_cpca',
  COMPLAINTS_SMIF: 'complaints_smif',
} as const;

export type AiKnowledgeSourceId =
  (typeof AI_KNOWLEDGE_SOURCE_IDS)[keyof typeof AI_KNOWLEDGE_SOURCE_IDS];

export const ALL_KNOWLEDGE_SOURCE_IDS: AiKnowledgeSourceId[] = [
  AI_KNOWLEDGE_SOURCE_IDS.MISSIONS,
  AI_KNOWLEDGE_SOURCE_IDS.ACTIVITIES_SMIF,
  AI_KNOWLEDGE_SOURCE_IDS.ACTIVITIES_CIPAVD,
  AI_KNOWLEDGE_SOURCE_IDS.ACTIVITY_REPORTS,
  AI_KNOWLEDGE_SOURCE_IDS.BEST_PRACTICES,
  AI_KNOWLEDGE_SOURCE_IDS.TASKS,
  AI_KNOWLEDGE_SOURCE_IDS.SURVEY_SCHOOLS,
  AI_KNOWLEDGE_SOURCE_IDS.SURVEY_DOMESTIC_VIOLENCE,
  AI_KNOWLEDGE_SOURCE_IDS.SURVEY_RECRUITS,
  AI_KNOWLEDGE_SOURCE_IDS.SURVEY_BEST_PRACTICE_CYCLE,
  AI_KNOWLEDGE_SOURCE_IDS.SURVEY_CPCA_MEETING,
  AI_KNOWLEDGE_SOURCE_IDS.SURVEY_GSD_EVALUATION,
  AI_KNOWLEDGE_SOURCE_IDS.COMPLAINTS_CPCA,
  AI_KNOWLEDGE_SOURCE_IDS.COMPLAINTS_SMIF,
];

export const AI_KNOWLEDGE_SOURCE_CATALOG: ReadonlyArray<{
  id: AiKnowledgeSourceId;
  label: string;
  description: string;
}> = [
  {
    id: AI_KNOWLEDGE_SOURCE_IDS.MISSIONS,
    label: 'Missões',
    description: 'Missões do sistema, com escopo SMIF e CIPAVD.',
  },
  {
    id: AI_KNOWLEDGE_SOURCE_IDS.ACTIVITIES_SMIF,
    label: 'Atividades de campo SMIF',
    description: 'Atividades de campo com escopo SMIF.',
  },
  {
    id: AI_KNOWLEDGE_SOURCE_IDS.ACTIVITIES_CIPAVD,
    label: 'Atividades de campo CIPAVD',
    description: 'Atividades de campo com escopo CIPAVD.',
  },
  {
    id: AI_KNOWLEDGE_SOURCE_IDS.ACTIVITY_REPORTS,
    label: 'Relatórios de atividades de campo',
    description: 'Relatórios de campo com textos, observações e conclusões.',
  },
  {
    id: AI_KNOWLEDGE_SOURCE_IDS.BEST_PRACTICES,
    label: 'Boas práticas',
    description: 'Registros de boas práticas cadastrados no sistema.',
  },
  {
    id: AI_KNOWLEDGE_SOURCE_IDS.TASKS,
    label: 'Tarefas',
    description: 'Aba de tarefas, templates, status e prazos.',
  },
  {
    id: AI_KNOWLEDGE_SOURCE_IDS.SURVEY_SCHOOLS,
    label: 'Pesquisas de escolas',
    description: 'Respostas da pesquisa institucional de escolas.',
  },
  {
    id: AI_KNOWLEDGE_SOURCE_IDS.SURVEY_DOMESTIC_VIOLENCE,
    label: 'Pesquisas de violência doméstica',
    description: 'Respostas de pesquisa de violência doméstica.',
  },
  {
    id: AI_KNOWLEDGE_SOURCE_IDS.SURVEY_RECRUITS,
    label: 'Pesquisa de recrutas',
    description: 'Respostas de pesquisa de recrutas e percepção de risco.',
  },
  {
    id: AI_KNOWLEDGE_SOURCE_IDS.SURVEY_BEST_PRACTICE_CYCLE,
    label: 'Pesquisa ciclo de boas práticas',
    description: 'Respostas de pesquisa de ciclo de boas práticas.',
  },
  {
    id: AI_KNOWLEDGE_SOURCE_IDS.SURVEY_CPCA_MEETING,
    label: 'Pesquisa encontro CPCA',
    description: 'Respostas de pesquisa de encontros CPCA.',
  },
  {
    id: AI_KNOWLEDGE_SOURCE_IDS.SURVEY_GSD_EVALUATION,
    label: 'Pesquisa avaliação GSD',
    description: 'Respostas de avaliação de GSD.',
  },
  {
    id: AI_KNOWLEDGE_SOURCE_IDS.COMPLAINTS_CPCA,
    label: 'Denúncias CPCA',
    description: 'Denúncias de CPCA no fluxo de atendimento.',
  },
  {
    id: AI_KNOWLEDGE_SOURCE_IDS.COMPLAINTS_SMIF,
    label: 'Denúncias SMIF',
    description: 'Denúncias de SMIF no fluxo de atendimento.',
  },
] as const;

export const ANALYSIS_DEFAULT_SOURCES: Record<
  AiAnalysisType,
  AiKnowledgeSourceId[]
> = {
  executive: [...ALL_KNOWLEDGE_SOURCE_IDS],
  situational: [...ALL_KNOWLEDGE_SOURCE_IDS],
  aggressor: [
    AI_KNOWLEDGE_SOURCE_IDS.COMPLAINTS_CPCA,
    AI_KNOWLEDGE_SOURCE_IDS.COMPLAINTS_SMIF,
  ],
  text: [
    AI_KNOWLEDGE_SOURCE_IDS.BEST_PRACTICES,
    AI_KNOWLEDGE_SOURCE_IDS.ACTIVITY_REPORTS,
    AI_KNOWLEDGE_SOURCE_IDS.COMPLAINTS_CPCA,
    AI_KNOWLEDGE_SOURCE_IDS.COMPLAINTS_SMIF,
  ],
  geo: [
    AI_KNOWLEDGE_SOURCE_IDS.MISSIONS,
    AI_KNOWLEDGE_SOURCE_IDS.ACTIVITIES_SMIF,
    AI_KNOWLEDGE_SOURCE_IDS.ACTIVITIES_CIPAVD,
    AI_KNOWLEDGE_SOURCE_IDS.COMPLAINTS_CPCA,
    AI_KNOWLEDGE_SOURCE_IDS.COMPLAINTS_SMIF,
  ],
  chatbot: [...ALL_KNOWLEDGE_SOURCE_IDS],
  briefing_comgep: [...ALL_KNOWLEDGE_SOURCE_IDS],
  priorizacao_intervencao: [...ALL_KNOWLEDGE_SOURCE_IDS],
  governanca_cpca: [...ALL_KNOWLEDGE_SOURCE_IDS],
};

export type AnalysisSourceSelection = Record<
  AiAnalysisType,
  AiKnowledgeSourceId[]
>;
