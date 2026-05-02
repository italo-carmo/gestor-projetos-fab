export const COMGEP_SCORING_SETTING_KEY = 'strategic.comgep.scoring';

export type ComgepScoringWeightKey =
  | 'riskOpenCases'
  | 'riskRetaliationCases'
  | 'riskStalledCases'
  | 'riskSexualFormalCases'
  | 'riskSurveyRate'
  | 'riskDomesticRate'
  | 'riskSexualSignals'
  | 'riskMoralSignals'
  | 'riskMilitaryAuthor'
  | 'riskUnderreportPercent'
  | 'riskUncoveredOmPenalty'
  | 'presenceMissions'
  | 'presenceCompletedActivities'
  | 'presenceSignedReports';

export type ComgepScoringGroupId = 'risk' | 'presence';

export type ComgepScoringWeights = Record<ComgepScoringWeightKey, number>;

export type ComgepScoringDefinition = {
  key: ComgepScoringWeightKey;
  group: ComgepScoringGroupId;
  label: string;
  description: string;
  impact: string;
  appliesTo: 'OM' | 'UF' | 'OM e UF';
  unitLabel: string;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
};

export const COMGEP_SCORING_DEFINITIONS: ComgepScoringDefinition[] = [
  {
    key: 'riskOpenCases',
    group: 'risk',
    label: 'Denúncias formais abertas',
    description:
      'Peso aplicado a cada denúncia formal ainda aberta. Quanto maior o valor, mais o passivo atual empurra a OM e a UF para o topo do ranking.',
    impact:
      'Afeta diretamente OMs de maior risco e UFs com atuação prioritária.',
    appliesTo: 'OM e UF',
    unitLabel: 'pontos por caso',
    defaultValue: 8,
    min: 0,
    max: 30,
    step: 0.5,
  },
  {
    key: 'riskRetaliationCases',
    group: 'risk',
    label: 'Risco de retaliação',
    description:
      'Peso aplicado a cada caso com marcação de risco de retaliação. Deve ser mais alto porque indica urgência institucional e necessidade de proteção.',
    impact:
      'Eleva rápido o score de risco em OMs e UFs com maior sensibilidade institucional.',
    appliesTo: 'OM e UF',
    unitLabel: 'pontos por caso',
    defaultValue: 12,
    min: 0,
    max: 40,
    step: 0.5,
  },
  {
    key: 'riskStalledCases',
    group: 'risk',
    label: 'Casos além do prazo',
    description:
      'Peso aplicado a cada caso aberto há mais de 30 dias. Mede acúmulo, lentidão e exposição da comissão.',
    impact:
      'Aumenta o risco quando existe passivo formal sem resposta no tempo esperado.',
    appliesTo: 'OM e UF',
    unitLabel: 'pontos por caso',
    defaultValue: 6,
    min: 0,
    max: 30,
    step: 0.5,
  },
  {
    key: 'riskSexualFormalCases',
    group: 'risk',
    label: 'Casos formais de assédio sexual',
    description:
      'Peso específico para casos formais classificados como assédio sexual. Serve para destacar gravidade e sensibilidade do tema no ranking.',
    impact: 'Destaca OMs e UFs onde há formalização de casos sexuais.',
    appliesTo: 'OM e UF',
    unitLabel: 'pontos por caso',
    defaultValue: 4,
    min: 0,
    max: 20,
    step: 0.5,
  },
  {
    key: 'riskSurveyRate',
    group: 'risk',
    label: 'Pesquisa institucional',
    description:
      'Peso por ponto percentual da taxa de relatos na pesquisa institucional normalizada por OM/UF.',
    impact:
      'Faz a pesquisa influenciar o ranking mesmo quando ainda não há denúncia formal.',
    appliesTo: 'OM e UF',
    unitLabel: 'pontos por 1% relatado',
    defaultValue: 0.7,
    min: 0,
    max: 5,
    step: 0.1,
  },
  {
    key: 'riskDomesticRate',
    group: 'risk',
    label: 'Violência doméstica em 12 meses',
    description:
      'Peso por ponto percentual da pesquisa de violência doméstica em 12 meses.',
    impact:
      'Eleva o score quando a pesquisa aponta prevalência relevante de violência doméstica.',
    appliesTo: 'OM e UF',
    unitLabel: 'pontos por 1% relatado',
    defaultValue: 0.8,
    min: 0,
    max: 5,
    step: 0.1,
  },
  {
    key: 'riskSexualSignals',
    group: 'risk',
    label: 'Sinais sexuais nas pesquisas',
    description:
      'Peso aplicado à soma dos relatos de assédio ou violência sexual vindos das pesquisas.',
    impact:
      'Ajuda a priorizar onde ações presenciais de prevenção e palestras tendem a ser mais necessárias.',
    appliesTo: 'OM e UF',
    unitLabel: 'pontos por relato',
    defaultValue: 2,
    min: 0,
    max: 15,
    step: 0.5,
  },
  {
    key: 'riskMoralSignals',
    group: 'risk',
    label: 'Sinais morais nas pesquisas',
    description:
      'Peso aplicado aos relatos de assédio ou violência moral vindos das pesquisas.',
    impact:
      'Ajuda a posicionar OMs e UFs com ambiente institucional degradado, mesmo sem alta formalização.',
    appliesTo: 'OM e UF',
    unitLabel: 'pontos por relato',
    defaultValue: 1.5,
    min: 0,
    max: 15,
    step: 0.5,
  },
  {
    key: 'riskMilitaryAuthor',
    group: 'risk',
    label: 'Autor vinculado ao meio militar',
    description:
      'Peso aplicado aos relatos da pesquisa de violência doméstica em que o autor tem vínculo com o meio militar.',
    impact:
      'Aumenta a prioridade de intervenção em OMs e UFs com necessidade de ação de comando e prevenção direcionada.',
    appliesTo: 'OM e UF',
    unitLabel: 'pontos por relato',
    defaultValue: 3,
    min: 0,
    max: 20,
    step: 0.5,
  },
  {
    key: 'riskUnderreportPercent',
    group: 'risk',
    label: 'Subnotificação estimada',
    description:
      'Peso por ponto percentual da subnotificação estimada ao comparar relatos em pesquisa com denúncias formais.',
    impact:
      'Ajuda a subir no ranking localidades com sinais fortes nas pesquisas, mas pouca formalização.',
    appliesTo: 'OM e UF',
    unitLabel: 'pontos por 1% estimado',
    defaultValue: 0.15,
    min: 0,
    max: 3,
    step: 0.05,
  },
  {
    key: 'riskUncoveredOmPenalty',
    group: 'risk',
    label: 'OM sem cobertura CPCA',
    description:
      'Penalidade fixa adicionada quando a OM não possui CPCA próprio nem cobertura de outra OM.',
    impact:
      'Age somente no ranking por OM, destacando descoberta institucional.',
    appliesTo: 'OM',
    unitLabel: 'pontos fixos',
    defaultValue: 10,
    min: 0,
    max: 40,
    step: 0.5,
  },
  {
    key: 'presenceMissions',
    group: 'presence',
    label: 'Missões realizadas',
    description:
      'Peso aplicado a cada missão executada na UF. Como o histórico ainda é inicial, o painel também aplica amortecimento estatístico antes de usar esse sinal no score.',
    impact:
      'Aumenta o score de presença, mas não deve ser interpretado como projeção determinística de risco ou resolução do problema.',
    appliesTo: 'UF',
    unitLabel: 'pontos por missão',
    defaultValue: 1.5,
    min: 0,
    max: 20,
    step: 0.5,
  },
  {
    key: 'presenceCompletedActivities',
    group: 'presence',
    label: 'Atividades de campo concluídas',
    description: 'Peso aplicado a cada atividade de campo concluída na UF.',
    impact:
      'Mostra presença tática de campo e ajuda a equilibrar risco com execução operacional.',
    appliesTo: 'UF',
    unitLabel: 'pontos por atividade',
    defaultValue: 3,
    min: 0,
    max: 20,
    step: 0.5,
  },
  {
    key: 'presenceSignedReports',
    group: 'presence',
    label: 'Relatórios assinados',
    description:
      'Peso aplicado aos relatórios assinados de atividades, como evidência de fechamento e materialização da ação.',
    impact:
      'Completa o score de presença com sinal de formalização da atuação em campo.',
    appliesTo: 'UF',
    unitLabel: 'pontos por relatório',
    defaultValue: 2,
    min: 0,
    max: 20,
    step: 0.5,
  },
];

export const DEFAULT_COMGEP_SCORING_WEIGHTS: ComgepScoringWeights =
  COMGEP_SCORING_DEFINITIONS.reduce((acc, item) => {
    acc[item.key] = item.defaultValue;
    return acc;
  }, {} as ComgepScoringWeights);

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const normalizeComgepScoringWeights = (
  input: Partial<Record<ComgepScoringWeightKey, unknown>> | null | undefined,
): ComgepScoringWeights => {
  const normalized = { ...DEFAULT_COMGEP_SCORING_WEIGHTS };
  for (const definition of COMGEP_SCORING_DEFINITIONS) {
    const raw = input?.[definition.key];
    if (raw === undefined || raw === null || raw === '') continue;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) continue;
    normalized[definition.key] = Number(
      clamp(parsed, definition.min, definition.max).toFixed(3),
    );
  }
  return normalized;
};

export const buildComgepScoringSettingsResponse = (
  weights: ComgepScoringWeights,
) => {
  const groups = [
    {
      id: 'risk' as const,
      label: 'Score de risco e priorização',
      description:
        'Esses pesos compõem o score que posiciona OMs e UFs nos rankings prioritários da Sala COMGEP. Maior peso significa maior impacto daquele sinal no topo da lista.',
      effectSummary:
        'Afeta diretamente as tabelas de OMs de maior risco e UFs com atuação prioritária.',
    },
    {
      id: 'presence' as const,
      label: 'Score de presença operacional',
      description:
        'Esses pesos compõem o score de presença operacional por UF, usado para equilibrar risco com atuação já executada em missões, atividades e relatórios.',
      effectSummary:
        'Afeta a leitura de presença operacional e a pressão operacional calculada para cada UF.',
    },
  ].map((group) => ({
    ...group,
    items: COMGEP_SCORING_DEFINITIONS.filter(
      (item) => item.group === group.id,
    ).map((item) => ({
      ...item,
      value: weights[item.key],
    })),
  }));

  return {
    groups,
    values: weights,
  };
};
