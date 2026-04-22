export const AI_ANALYSIS_TYPES = [
  'executive',
  'situational',
  'aggressor',
  'text',
  'geo',
  'chatbot',
  'cpca_agent',
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
  cpca_agent: [
    AI_KNOWLEDGE_SOURCE_IDS.COMPLAINTS_CPCA,
    AI_KNOWLEDGE_SOURCE_IDS.MISSIONS,
    AI_KNOWLEDGE_SOURCE_IDS.ACTIVITIES_SMIF,
    AI_KNOWLEDGE_SOURCE_IDS.ACTIVITIES_CIPAVD,
    AI_KNOWLEDGE_SOURCE_IDS.TASKS,
    AI_KNOWLEDGE_SOURCE_IDS.SURVEY_CPCA_MEETING,
  ],
  briefing_comgep: [...ALL_KNOWLEDGE_SOURCE_IDS],
  priorizacao_intervencao: [...ALL_KNOWLEDGE_SOURCE_IDS],
  governanca_cpca: [...ALL_KNOWLEDGE_SOURCE_IDS],
};

export type AnalysisSourceSelection = Record<
  AiAnalysisType,
  AiKnowledgeSourceId[]
>;

export const AI_PROFILE_FEATURE_IDS = {
  STRUCTURED_SITUATIONAL: 'structured_situational',
  STRUCTURED_COMPLAINTS: 'structured_complaints',
  STRUCTURED_TEXT: 'structured_text',
  STRUCTURED_GEO: 'structured_geo',
  RAG_KNOWLEDGE_BASES: 'rag_knowledge_bases',
  TRACEABILITY_LINKS: 'traceability_links',
  SUGGESTED_LINKS: 'suggested_links',
  SUGGESTED_ACTIONS: 'suggested_actions',
  CPCA_CASE_INCONSISTENCIES: 'cpca_case_inconsistencies',
  COMGEP_ROOM: 'comgep_room',
} as const;

export type AiProfileFeatureId =
  (typeof AI_PROFILE_FEATURE_IDS)[keyof typeof AI_PROFILE_FEATURE_IDS];

export const ALL_AI_PROFILE_FEATURE_IDS: AiProfileFeatureId[] = [
  AI_PROFILE_FEATURE_IDS.STRUCTURED_SITUATIONAL,
  AI_PROFILE_FEATURE_IDS.STRUCTURED_COMPLAINTS,
  AI_PROFILE_FEATURE_IDS.STRUCTURED_TEXT,
  AI_PROFILE_FEATURE_IDS.STRUCTURED_GEO,
  AI_PROFILE_FEATURE_IDS.RAG_KNOWLEDGE_BASES,
  AI_PROFILE_FEATURE_IDS.TRACEABILITY_LINKS,
  AI_PROFILE_FEATURE_IDS.SUGGESTED_LINKS,
  AI_PROFILE_FEATURE_IDS.SUGGESTED_ACTIONS,
  AI_PROFILE_FEATURE_IDS.CPCA_CASE_INCONSISTENCIES,
  AI_PROFILE_FEATURE_IDS.COMGEP_ROOM,
];

export const AI_PROFILE_FEATURE_CATALOG: ReadonlyArray<{
  id: AiProfileFeatureId;
  label: string;
  description: string;
}> = [
  {
    id: AI_PROFILE_FEATURE_IDS.STRUCTURED_SITUATIONAL,
    label: 'Panorama situacional',
    description:
      'Permite usar panorama estruturado com pesquisas, denúncias, missões, atividades e tarefas.',
  },
  {
    id: AI_PROFILE_FEATURE_IDS.STRUCTURED_COMPLAINTS,
    label: 'Perfis de denúncias',
    description:
      'Permite usar perfis de agressor, vítima, relações hierárquicas e estatísticas de denúncias.',
  },
  {
    id: AI_PROFILE_FEATURE_IDS.STRUCTURED_TEXT,
    label: 'Sinais textuais',
    description:
      'Permite usar análise textual consolidada a partir de relatórios, observações e textos livres.',
  },
  {
    id: AI_PROFILE_FEATURE_IDS.STRUCTURED_GEO,
    label: 'Recorte geográfico',
    description:
      'Permite usar recortes por UF, localidade e distribuição territorial.',
  },
  {
    id: AI_PROFILE_FEATURE_IDS.RAG_KNOWLEDGE_BASES,
    label: 'RAG em bases de conhecimento',
    description:
      'Permite recuperar trechos semânticos e lexicais das bases documentais selecionadas.',
  },
  {
    id: AI_PROFILE_FEATURE_IDS.TRACEABILITY_LINKS,
    label: 'Referências e rastreabilidade',
    description:
      'Acrescenta referências estruturadas e documentais ao final das respostas.',
  },
  {
    id: AI_PROFILE_FEATURE_IDS.SUGGESTED_LINKS,
    label: 'Links sugeridos',
    description:
      'Permite sugerir telas e registros do sistema ao final da resposta do chatbot.',
  },
  {
    id: AI_PROFILE_FEATURE_IDS.SUGGESTED_ACTIONS,
    label: 'Ações sugeridas',
    description:
      'Permite sugerir atalhos operacionais como criar missão, atividade, tarefa ou cronograma.',
  },
  {
    id: AI_PROFILE_FEATURE_IDS.CPCA_CASE_INCONSISTENCIES,
    label: 'Inconsistências CPCA',
    description:
      'Libera a camada analítica de inconsistências cadastrais, cronológicas e normativas nas denúncias CPCA.',
  },
  {
    id: AI_PROFILE_FEATURE_IDS.COMGEP_ROOM,
    label: 'Sala COMGEP',
    description:
      'Permite consultar o contexto estruturado da Sala COMGEP nos copilotos gerenciais.',
  },
] as const;

export type AiProfileFeatureSelection = Record<
  AiAnalysisType,
  AiProfileFeatureId[]
>;

export const ANALYSIS_DEFAULT_FEATURES: AiProfileFeatureSelection = {
  executive: [
    AI_PROFILE_FEATURE_IDS.STRUCTURED_SITUATIONAL,
    AI_PROFILE_FEATURE_IDS.STRUCTURED_COMPLAINTS,
    AI_PROFILE_FEATURE_IDS.STRUCTURED_TEXT,
    AI_PROFILE_FEATURE_IDS.STRUCTURED_GEO,
    AI_PROFILE_FEATURE_IDS.RAG_KNOWLEDGE_BASES,
    AI_PROFILE_FEATURE_IDS.TRACEABILITY_LINKS,
  ],
  situational: [
    AI_PROFILE_FEATURE_IDS.STRUCTURED_SITUATIONAL,
    AI_PROFILE_FEATURE_IDS.RAG_KNOWLEDGE_BASES,
    AI_PROFILE_FEATURE_IDS.TRACEABILITY_LINKS,
  ],
  aggressor: [
    AI_PROFILE_FEATURE_IDS.STRUCTURED_SITUATIONAL,
    AI_PROFILE_FEATURE_IDS.STRUCTURED_COMPLAINTS,
    AI_PROFILE_FEATURE_IDS.RAG_KNOWLEDGE_BASES,
    AI_PROFILE_FEATURE_IDS.TRACEABILITY_LINKS,
  ],
  text: [
    AI_PROFILE_FEATURE_IDS.STRUCTURED_TEXT,
    AI_PROFILE_FEATURE_IDS.RAG_KNOWLEDGE_BASES,
    AI_PROFILE_FEATURE_IDS.TRACEABILITY_LINKS,
  ],
  geo: [
    AI_PROFILE_FEATURE_IDS.STRUCTURED_SITUATIONAL,
    AI_PROFILE_FEATURE_IDS.STRUCTURED_GEO,
    AI_PROFILE_FEATURE_IDS.RAG_KNOWLEDGE_BASES,
    AI_PROFILE_FEATURE_IDS.TRACEABILITY_LINKS,
  ],
  chatbot: [
    AI_PROFILE_FEATURE_IDS.STRUCTURED_SITUATIONAL,
    AI_PROFILE_FEATURE_IDS.STRUCTURED_COMPLAINTS,
    AI_PROFILE_FEATURE_IDS.STRUCTURED_TEXT,
    AI_PROFILE_FEATURE_IDS.STRUCTURED_GEO,
    AI_PROFILE_FEATURE_IDS.RAG_KNOWLEDGE_BASES,
    AI_PROFILE_FEATURE_IDS.TRACEABILITY_LINKS,
    AI_PROFILE_FEATURE_IDS.SUGGESTED_LINKS,
    AI_PROFILE_FEATURE_IDS.SUGGESTED_ACTIONS,
  ],
  cpca_agent: [
    AI_PROFILE_FEATURE_IDS.STRUCTURED_SITUATIONAL,
    AI_PROFILE_FEATURE_IDS.STRUCTURED_COMPLAINTS,
    AI_PROFILE_FEATURE_IDS.STRUCTURED_TEXT,
    AI_PROFILE_FEATURE_IDS.RAG_KNOWLEDGE_BASES,
    AI_PROFILE_FEATURE_IDS.TRACEABILITY_LINKS,
    AI_PROFILE_FEATURE_IDS.SUGGESTED_LINKS,
    AI_PROFILE_FEATURE_IDS.CPCA_CASE_INCONSISTENCIES,
  ],
  briefing_comgep: [
    AI_PROFILE_FEATURE_IDS.COMGEP_ROOM,
    AI_PROFILE_FEATURE_IDS.RAG_KNOWLEDGE_BASES,
    AI_PROFILE_FEATURE_IDS.TRACEABILITY_LINKS,
  ],
  priorizacao_intervencao: [
    AI_PROFILE_FEATURE_IDS.COMGEP_ROOM,
    AI_PROFILE_FEATURE_IDS.RAG_KNOWLEDGE_BASES,
    AI_PROFILE_FEATURE_IDS.TRACEABILITY_LINKS,
  ],
  governanca_cpca: [
    AI_PROFILE_FEATURE_IDS.COMGEP_ROOM,
    AI_PROFILE_FEATURE_IDS.RAG_KNOWLEDGE_BASES,
    AI_PROFILE_FEATURE_IDS.TRACEABILITY_LINKS,
  ],
};
