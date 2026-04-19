export type AiCopilotType =
  | 'briefing_comgep'
  | 'priorizacao_intervencao'
  | 'governanca_cpca';

export type AiCopilotMode = 'executive' | 'analyst';

export type AiCopilotIntent = 'explain' | 'briefing' | 'action';

export type AiCopilotFocusKind =
  | 'overview'
  | 'kpi_covered_oms'
  | 'kpi_critical_ufs'
  | 'kpi_high_risk_oms'
  | 'kpi_operational_presence'
  | 'uf'
  | 'om'
  | 'coverage_gap'
  | 'operational_pressure';

export type AiCopilotFocus = {
  kind: AiCopilotFocusKind;
  uf?: string | null;
  omId?: string | null;
  refId?: string | null;
};

export type AiCopilotLaunch = {
  type: AiCopilotType;
  mode?: AiCopilotMode;
  intent?: AiCopilotIntent;
  label?: string;
  description?: string;
  focus?: AiCopilotFocus | null;
};

const COPILOT_TYPES = new Set<AiCopilotType>([
  'briefing_comgep',
  'priorizacao_intervencao',
  'governanca_cpca',
]);

const COPILOT_MODES = new Set<AiCopilotMode>(['executive', 'analyst']);

const COPILOT_INTENTS = new Set<AiCopilotIntent>([
  'explain',
  'briefing',
  'action',
]);

const COPILOT_FOCUS_KINDS = new Set<AiCopilotFocusKind>([
  'overview',
  'kpi_covered_oms',
  'kpi_critical_ufs',
  'kpi_high_risk_oms',
  'kpi_operational_presence',
  'uf',
  'om',
  'coverage_gap',
  'operational_pressure',
]);

const COPILOT_SEARCH_KEYS = [
  'copilotType',
  'copilotMode',
  'copilotIntent',
  'copilotLabel',
  'copilotDescription',
  'copilotFocusKind',
  'copilotUf',
  'copilotOmId',
  'copilotRefId',
] as const;

function clean(value: string | null | undefined) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

export function buildAiCopilotPath(input: AiCopilotLaunch) {
  const params = new URLSearchParams();
  params.set('tab', 'assistant');
  params.set('copilotType', input.type);
  params.set('copilotMode', input.mode ?? 'executive');

  if (input.intent) params.set('copilotIntent', input.intent);
  if (clean(input.label)) params.set('copilotLabel', clean(input.label)!);
  if (clean(input.description)) {
    params.set('copilotDescription', clean(input.description)!);
  }
  if (input.focus?.kind) params.set('copilotFocusKind', input.focus.kind);
  if (clean(input.focus?.uf)) params.set('copilotUf', clean(input.focus?.uf)!);
  if (clean(input.focus?.omId)) params.set('copilotOmId', clean(input.focus?.omId)!);
  if (clean(input.focus?.refId)) params.set('copilotRefId', clean(input.focus?.refId)!);

  return `/ai?${params.toString()}`;
}

export function parseAiCopilotLaunch(searchParams: URLSearchParams): AiCopilotLaunch | null {
  const type = clean(searchParams.get('copilotType')) as AiCopilotType | null;
  if (!type || !COPILOT_TYPES.has(type)) return null;

  const mode = clean(searchParams.get('copilotMode')) as AiCopilotMode | null;
  const intent = clean(searchParams.get('copilotIntent')) as AiCopilotIntent | null;
  const label = clean(searchParams.get('copilotLabel'));
  const description = clean(searchParams.get('copilotDescription'));
  const kind = clean(searchParams.get('copilotFocusKind')) as AiCopilotFocusKind | null;
  const uf = clean(searchParams.get('copilotUf'));
  const omId = clean(searchParams.get('copilotOmId'));
  const refId = clean(searchParams.get('copilotRefId'));

  const focus = kind && COPILOT_FOCUS_KINDS.has(kind)
    ? {
        kind,
        uf,
        omId,
        refId,
      }
    : null;

  return {
    type,
    mode: mode && COPILOT_MODES.has(mode) ? mode : 'executive',
    intent: intent && COPILOT_INTENTS.has(intent) ? intent : undefined,
    label: label ?? undefined,
    description: description ?? undefined,
    focus,
  };
}

export function stripAiCopilotLaunchParams(searchParams: URLSearchParams) {
  const next = new URLSearchParams(searchParams);
  COPILOT_SEARCH_KEYS.forEach((key) => next.delete(key));
  return next;
}

export function buildAiCopilotLaunchTitle(input: AiCopilotLaunch) {
  const targetLabel = clean(input.label) ?? describeAiCopilotTarget(input.focus);
  if (input.intent === 'action') {
    return targetLabel ? `Transformar em ação — ${targetLabel}` : 'Transformar em ação';
  }
  if (input.intent === 'briefing') {
    return targetLabel ? `Gerar briefing — ${targetLabel}` : 'Gerar briefing';
  }
  if (input.intent === 'explain') {
    return targetLabel ? `Explicar na IA — ${targetLabel}` : 'Explicar na IA';
  }
  return targetLabel ? `Executar copiloto — ${targetLabel}` : 'Executar copiloto';
}

export function buildAiCopilotLaunchMessage(input: AiCopilotLaunch) {
  const title = buildAiCopilotLaunchTitle(input);
  const description = clean(input.description);
  return description ? `${title}. Contexto: ${description}` : title;
}

export function describeAiCopilotTarget(focus?: AiCopilotFocus | null) {
  if (!focus) return null;
  switch (focus.kind) {
    case 'uf':
      return focus.uf ? `UF ${focus.uf}` : 'UF selecionada';
    case 'om':
      return 'OM selecionada';
    case 'kpi_critical_ufs':
      return 'UFs críticas';
    case 'kpi_high_risk_oms':
      return 'OMs de maior risco';
    case 'kpi_covered_oms':
      return 'Cobertura CPCA';
    case 'kpi_operational_presence':
      return 'Presença operacional';
    case 'coverage_gap':
      return 'gaps de cobertura';
    case 'operational_pressure':
      return 'pressão operacional';
    default:
      return 'painel estratégico';
  }
}
