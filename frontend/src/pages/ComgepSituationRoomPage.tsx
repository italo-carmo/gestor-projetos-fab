import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import HubRoundedIcon from '@mui/icons-material/HubRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import AddTaskRoundedIcon from '@mui/icons-material/AddTaskRounded';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import PlaylistPlayRoundedIcon from '@mui/icons-material/PlaylistPlayRounded';
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { useMemo, useRef, useState } from 'react';
import { api } from '../api/client';
import {
  useAiActionAgents,
  useComgepRecommendations,
  useComgepSituationRoom,
  useCreateComgepRecommendation,
  useCreateMission,
  useCreateTaskInstance,
  useCipavdLocalities,
  useExportComgepCopilotPdf,
  useLocalities,
  useMe,
  usePhases,
} from '../api/hooks';
import { can } from '../app/rbac';
import { parseApiError } from '../app/apiErrors';
import { consumeJsonSseStream } from '../app/sse';
import { useToast } from '../app/toast';
import { ErrorState } from '../components/states/ErrorState';
import { SkeletonState } from '../components/states/SkeletonState';

function getBaseUrl(): string {
  return (api.defaults.baseURL as string) ?? '/api';
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('accessToken');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const roleId = localStorage.getItem('activeRoleId');
  if (roleId) headers['x-active-role-id'] = roleId;
  return headers;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR');
}

function formatPercent(value: unknown) {
  const numeric = Number(value ?? 0);
  return `${numeric.toFixed(1)}%`;
}

function resolvePriorityColor(value: string) {
  if (value === 'CRÍTICA') return 'error';
  if (value === 'ALTA') return 'warning';
  if (value === 'ATENÇÃO') return 'info';
  return 'success';
}

function buildRiskReason(item: any) {
  const reasons: string[] = [];
  const complaints = item?.complaints ?? {};
  if (Number(complaints?.openCases ?? 0) > 0) {
    reasons.push(`${complaints.openCases} denúncia(s) aberta(s)`);
  }
  if (Number(complaints?.retaliationCases ?? 0) > 0) {
    reasons.push(`${complaints.retaliationCases} com risco de retaliação`);
  }
  if (Number(complaints?.stalledCases ?? 0) > 0) {
    reasons.push(`${complaints.stalledCases} parada(s) além do prazo`);
  }
  if (Number(item?.surveyRate ?? 0) >= 20) {
    reasons.push(`sinal elevado em pesquisa institucional (${formatPercent(item.surveyRate)})`);
  }
  if (Number(item?.domesticRate ?? 0) >= 15) {
    reasons.push(`sinal elevado em violência doméstica (${formatPercent(item.domesticRate)})`);
  }
  if (item?.covered === false) {
    reasons.push('sem cobertura CPCA associada');
  }
  return reasons.slice(0, 3).join(' • ') || 'Risco composto por denúncias, sinais BI e condição de cobertura.';
}

function buildPriorityUfReason(item: any) {
  return `Cobertura ${formatPercent(item?.coveragePercent)} • Presença ${item?.presenceScore ?? 0} • ${item?.recommendedFocus ?? 'Monitorar cenário.'}`;
}

function buildCoverageGapReason(item: any) {
  const complaints = item?.complaints ?? {};
  return [
    'A OM permanece sem CPCA própria ou sem cobertura por outra comissão.',
    Number(complaints?.openCases ?? 0) > 0
      ? `${complaints.openCases} denúncia(s) aberta(s) elevam a urgência.`
      : null,
    Number(item?.riskScore ?? 0) >= 70
      ? `Score de risco ${item.riskScore} exige correção de governança.`
      : null,
  ]
    .filter(Boolean)
    .join(' ');
}

function buildPressureReason(item: any) {
  return `Pressão calculada pela diferença entre risco (${item?.riskScore ?? 0}) e presença (${item?.presenceScore ?? 0}). ${item?.recommendedFocus ?? ''}`.trim();
}

function buildDataConfidenceExplanation(dataConfidence: any) {
  const coverage = Number(dataConfidence?.supportedCoveragePercent ?? 0);
  if (coverage >= 80) {
    return 'A maior parte dos registros BI já está vinculada a OM ou UF, permitindo leitura executiva com boa sustentação analítica.';
  }
  if (coverage >= 50) {
    return 'A leitura já é útil, mas parte relevante da base ainda depende só de UF ou permanece sem vínculo suficiente para cruzamento fino por OM.';
  }
  return 'A base ainda tem baixa sustentação para leitura executiva detalhada. O gestor deve interpretar sinais com cautela até ampliar a normalização.';
}

function SummaryCard({
  icon,
  title,
  value,
  subtitle,
  description,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  subtitle: string;
  description?: string;
  color: string;
  onClick?: () => void;
}) {
  return (
    <Card
      variant="outlined"
      onClick={onClick}
      sx={{
        borderRadius: 3,
        borderTop: `4px solid ${color}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
        '&:hover': onClick
          ? {
              transform: 'translateY(-2px)',
              boxShadow: '0 16px 36px rgba(15, 35, 64, 0.08)',
              borderColor: color,
            }
          : undefined,
      }}
    >
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
              {title}
            </Typography>
            <Typography variant="h4" fontWeight={800} sx={{ color, mt: 0.3 }}>
              {value}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.8 }}>
              {subtitle}
            </Typography>
            {description ? (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.8, display: 'block', lineHeight: 1.55 }}>
                {description}
              </Typography>
            ) : null}
            {onClick ? (
              <Typography variant="caption" sx={{ mt: 1.1, display: 'block', color, fontWeight: 700 }}>
                Clique para detalhar
              </Typography>
            ) : null}
          </Box>
          <Box sx={{ color }}>{icon}</Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function MarkdownPanel({ content }: { content: string }) {
  return (
    <Box
      sx={{
        '& h1, & h2, & h3': { color: '#1A3C6E', fontWeight: 800, mt: 1.6 },
        '& p': { fontSize: '0.9rem', lineHeight: 1.75 },
        '& ul, & ol': { pl: 3 },
        '& li': { mb: 0.6 },
        '& strong': { color: '#102C57' },
        '& table': { width: '100%', borderCollapse: 'collapse', my: 1.5 },
        '& th, & td': { border: '1px solid #D7DEE9', p: 0.8, textAlign: 'left' },
        '& th': { backgroundColor: '#1A3C6E', color: '#fff' },
      }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </Box>
  );
}

type CopilotFocus = {
  kind:
    | 'overview'
    | 'kpi_covered_oms'
    | 'kpi_critical_ufs'
    | 'kpi_high_risk_oms'
    | 'kpi_operational_presence'
    | 'uf'
    | 'om'
    | 'coverage_gap'
    | 'operational_pressure';
  label?: string;
  description?: string;
  uf?: string | null;
  omId?: string | null;
  refId?: string | null;
};

type CopilotEvidence = {
  id: string;
  omId: string | null;
  omCode: string;
  omName: string;
  title: string;
  uf: string;
  score: number;
  reason: string;
  link: string;
  source: string;
  coverageType?: string | null;
};

type CopilotMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  mode: 'executive' | 'analyst';
  focus: CopilotFocus | null;
  evidences: CopilotEvidence[];
};

type CopilotState = {
  running: boolean;
  percent: number;
  stage: string;
  draft: string;
  model: string;
  generatedAt: string;
  error: string;
  agentType: string;
  sessionId: string | null;
  messages: CopilotMessage[];
  mode: 'executive' | 'analyst';
  focus: CopilotFocus | null;
  scopeUf: string | null;
};

function describeCopilotFocus(
  focus: CopilotFocus | null,
  scopeUf?: string | null,
) {
  if (!focus) {
    return scopeUf ? `cenário geral da UF ${scopeUf}` : 'cenário geral da Sala COMGEP';
  }
  if (focus.label) return focus.label;
  switch (focus.kind) {
    case 'kpi_covered_oms':
      return 'OMs cobertas pela CPCA';
    case 'kpi_critical_ufs':
      return 'UFs prioritárias';
    case 'kpi_high_risk_oms':
      return 'OMs de maior risco';
    case 'kpi_operational_presence':
      return 'presença operacional';
    case 'uf':
      return focus.uf ? `UF ${focus.uf}` : 'UF selecionada';
    case 'om':
      return focus.description || 'OM selecionada';
    case 'coverage_gap':
      return focus.description || 'gaps de cobertura CPCA';
    case 'operational_pressure':
      return focus.description || 'pressão operacional';
    default:
      return scopeUf ? `cenário geral da UF ${scopeUf}` : 'cenário geral da Sala COMGEP';
  }
}

function buildCopilotExecutionMessage(
  agentTitle: string,
  mode: 'executive' | 'analyst',
  focus: CopilotFocus | null,
  scopeUf?: string | null,
) {
  return `Executar ${agentTitle} no modo ${
    mode === 'analyst' ? 'analista' : 'executivo'
  } com foco em ${describeCopilotFocus(focus, scopeUf)}.`;
}

function buildRecommendationTitle(
  agentTitle: string,
  focus: CopilotFocus | null,
  scopeUf?: string | null,
) {
  return `${agentTitle} · ${describeCopilotFocus(focus, scopeUf)}`;
}

function buildEvidenceSummary(evidences: CopilotEvidence[]) {
  if (!evidences.length) return 'Sem evidências estruturadas retornadas pelo copiloto.';
  return evidences
    .slice(0, 6)
    .map(
      (item) =>
        `${item.omCode} (${item.uf}) • score ${item.score} • ${item.reason}`,
    )
    .join('\n');
}

function useComgepCopilotRunner() {
  const abortRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<CopilotState>({
    running: false,
    percent: 0,
    stage: '',
    draft: '',
    model: '',
    generatedAt: '',
    error: '',
    agentType: '',
    sessionId: null,
    messages: [],
    mode: 'executive',
    focus: null,
    scopeUf: null,
  });

  const start = async (args: {
    type: string;
    title: string;
    uf?: string | null;
    mode: 'executive' | 'analyst';
    focus: CopilotFocus | null;
  }) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const userMessage: CopilotMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: buildCopilotExecutionMessage(
        args.title,
        args.mode,
        args.focus,
        args.uf || null,
      ),
      createdAt: new Date().toISOString(),
      mode: args.mode,
      focus: args.focus,
      evidences: [],
    };

    setState({
      running: true,
      percent: 0,
      stage: 'Iniciando...',
      draft: '',
      model: '',
      generatedAt: '',
      error: '',
      agentType: args.type,
      sessionId: null,
      messages: [userMessage],
      mode: args.mode,
      focus: args.focus,
      scopeUf: args.uf || null,
    });

    try {
      const res = await fetch(`${getBaseUrl()}/ai/action-agents/run`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          type: args.type,
          uf: args.uf || null,
          mode: args.mode,
          focus: args.focus,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        let message = `Erro HTTP ${res.status}`;
        try {
          message = JSON.parse(text)?.message ?? message;
        } catch {}
        setState((prev) => ({ ...prev, running: false, error: message }));
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setState((prev) => ({
          ...prev,
          running: false,
          error: 'O servidor não retornou um stream válido para o agente.',
        }));
        return;
      }

      let sawTerminalEvent = false;
      await consumeJsonSseStream(reader, (event, data) => {
        if (event === 'progress') {
          setState((prev) => ({
            ...prev,
            percent: data.percent ?? prev.percent,
            stage: data.stage ?? prev.stage,
          }));
          return;
        }

        if (event === 'token') {
          setState((prev) => ({
            ...prev,
            percent: data.percent ?? prev.percent,
            draft: prev.draft + (data.text ?? ''),
          }));
          return;
        }

        if (event === 'done') {
          sawTerminalEvent = true;
          const assistantMessage: CopilotMessage = {
            id: String(data.messageId ?? `assistant-${Date.now()}`),
            role: 'assistant',
            content: data.narrative ?? '',
            createdAt: data.generatedAt ?? new Date().toISOString(),
            mode: (data.mode ?? args.mode) as 'executive' | 'analyst',
            focus: (data.focus as CopilotFocus | null | undefined) ?? args.focus,
            evidences: Array.isArray(data.evidences) ? data.evidences : [],
          };
          setState((prev) => ({
            ...prev,
            running: false,
            percent: 100,
            draft: '',
            model: data.model ?? '',
            generatedAt: data.generatedAt ?? '',
            sessionId: data.sessionId ?? prev.sessionId,
            focus: assistantMessage.focus ?? prev.focus,
            messages: [userMessage, assistantMessage],
          }));
          return;
        }

        if (event === 'error') {
          sawTerminalEvent = true;
          setState((prev) => ({
            ...prev,
            running: false,
            error: data.message ?? 'Erro desconhecido',
          }));
        }
      });

      if (!sawTerminalEvent) {
        setState((prev) => ({
          ...prev,
          running: false,
          error:
            prev.draft.trim() || prev.error
              ? prev.error
              : 'A execução do agente foi encerrada sem resposta final.',
        }));
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      setState((prev) => ({
        ...prev,
        running: false,
        error: error?.message ?? 'Erro de rede',
      }));
    }
  };

  const followUp = async (args: {
    message: string;
    mode: 'executive' | 'analyst';
    focus: CopilotFocus | null;
  }) => {
    const safeMessage = String(args.message ?? '').trim();
    if (!safeMessage || !state.sessionId) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const userMessage: CopilotMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: safeMessage,
      createdAt: new Date().toISOString(),
      mode: args.mode,
      focus: args.focus,
      evidences: [],
    };

    setState((prev) => ({
      ...prev,
      running: true,
      percent: 0,
      stage: 'Processando follow-up...',
      draft: '',
      error: '',
      mode: args.mode,
      focus: args.focus,
      messages: [...prev.messages, userMessage],
    }));

    try {
      const res = await fetch(`${getBaseUrl()}/ai/action-agents/follow-up`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          sessionId: state.sessionId,
          message: safeMessage,
          mode: args.mode,
          focus: args.focus,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        let message = `Erro HTTP ${res.status}`;
        try {
          message = JSON.parse(text)?.message ?? message;
        } catch {}
        setState((prev) => ({ ...prev, running: false, error: message }));
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setState((prev) => ({
          ...prev,
          running: false,
          error: 'O servidor não retornou um stream válido para o copiloto.',
        }));
        return;
      }

      let sawTerminalEvent = false;
      await consumeJsonSseStream(reader, (event, data) => {
        if (event === 'progress') {
          setState((prev) => ({
            ...prev,
            percent: data.percent ?? prev.percent,
            stage: data.stage ?? prev.stage,
          }));
          return;
        }

        if (event === 'token') {
          setState((prev) => ({
            ...prev,
            percent: data.percent ?? prev.percent,
            draft: prev.draft + (data.text ?? ''),
          }));
          return;
        }

        if (event === 'done') {
          sawTerminalEvent = true;
          const assistantMessage: CopilotMessage = {
            id: String(data.messageId ?? `assistant-${Date.now()}`),
            role: 'assistant',
            content: data.narrative ?? '',
            createdAt: data.generatedAt ?? new Date().toISOString(),
            mode: (data.mode ?? args.mode) as 'executive' | 'analyst',
            focus: (data.focus as CopilotFocus | null | undefined) ?? args.focus,
            evidences: Array.isArray(data.evidences) ? data.evidences : [],
          };
          setState((prev) => ({
            ...prev,
            running: false,
            percent: 100,
            draft: '',
            model: data.model ?? prev.model,
            generatedAt: data.generatedAt ?? prev.generatedAt,
            sessionId: data.sessionId ?? prev.sessionId,
            focus: assistantMessage.focus ?? prev.focus,
            messages: [...prev.messages, assistantMessage],
          }));
          return;
        }

        if (event === 'error') {
          sawTerminalEvent = true;
          setState((prev) => ({
            ...prev,
            running: false,
            error: data.message ?? 'Erro desconhecido',
          }));
        }
      });

      if (!sawTerminalEvent) {
        setState((prev) => ({
          ...prev,
          running: false,
          error:
            prev.draft.trim() || prev.error
              ? prev.error
              : 'A execução do copiloto foi encerrada sem resposta final.',
        }));
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      setState((prev) => ({
        ...prev,
        running: false,
        error: error?.message ?? 'Erro de rede',
      }));
    }
  };

  const reset = () => {
    if (abortRef.current) abortRef.current.abort();
    setState({
      running: false,
      percent: 0,
      stage: '',
      draft: '',
      model: '',
      generatedAt: '',
      error: '',
      agentType: '',
      sessionId: null,
      messages: [],
      mode: 'executive',
      focus: null,
      scopeUf: null,
    });
  };

  return { state, start, followUp, reset };
}

function ComgepCopilotPanel(props: {
  agentCatalog: any[];
  matrixItems: any[];
  focus: CopilotFocus | null;
  onFocusChange: (focus: CopilotFocus | null) => void;
  scopeUf: string;
  onScopeUfChange: (value: string) => void;
}) {
  const { push } = useToast();
  const meQuery = useMe();
  const phasesQuery = usePhases();
  const recommendationsQuery = useComgepRecommendations(6);
  const createTaskMutation = useCreateTaskInstance();
  const createMissionMutation = useCreateMission();
  const createRecommendationMutation = useCreateComgepRecommendation();
  const exportPdfMutation = useExportComgepCopilotPdf();
  const { state, start, followUp, reset } = useComgepCopilotRunner();
  const [mode, setMode] = useState<'executive' | 'analyst'>('executive');
  const [followUpMessage, setFollowUpMessage] = useState('');
  const [taskDialogMessage, setTaskDialogMessage] = useState<CopilotMessage | null>(null);
  const [missionDialogMessage, setMissionDialogMessage] = useState<CopilotMessage | null>(null);
  const [recommendationDialogMessage, setRecommendationDialogMessage] =
    useState<CopilotMessage | null>(null);
  const [evidenceDialogMessage, setEvidenceDialogMessage] =
    useState<CopilotMessage | null>(null);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    phaseId: '',
    dueDate: '',
    priority: 'MEDIUM',
    localityIds: [] as string[],
  });
  const [missionForm, setMissionForm] = useState({
    title: '',
    description: '',
    scope: 'SMIF' as 'SMIF' | 'CIPAVD',
    localityId: '',
    startDate: '',
    endDate: '',
  });
  const [recommendationForm, setRecommendationForm] = useState({
    title: '',
    summary: '',
  });

  const me = meQuery.data;
  const canCreateTask = can(me, 'task_instances', 'update');
  const canCreateMission = can(me, 'missions', 'create');
  const localitiesQuery = useLocalities(canCreateTask || canCreateMission);
  const cipavdLocalitiesQuery = useCipavdLocalities(canCreateMission);

  const effectiveFocus =
    props.focus ??
    (props.scopeUf
      ? {
          kind: 'uf',
          label: `UF ${props.scopeUf}`,
          description: `Leitura concentrada na UF ${props.scopeUf}.`,
          uf: props.scopeUf,
        }
      : null);

  const latestAssistantMessage = useMemo(
    () =>
      [...state.messages]
        .reverse()
        .find((item) => item.role === 'assistant') ?? null,
    [state.messages],
  );

  const focusUf = String(
    effectiveFocus?.uf ??
      latestAssistantMessage?.focus?.uf ??
      latestAssistantMessage?.evidences?.[0]?.uf ??
      props.scopeUf ??
      '',
  )
    .trim()
    .toUpperCase();

  const smifLocalities = Array.isArray(localitiesQuery.data?.items)
    ? localitiesQuery.data.items
    : [];
  const cipavdLocalities = Array.isArray(cipavdLocalitiesQuery.data?.items)
    ? cipavdLocalitiesQuery.data.items
    : [];
  const phases = Array.isArray(phasesQuery.data?.items) ? phasesQuery.data.items : [];
  const recommendations = Array.isArray(recommendationsQuery.data?.items)
    ? recommendationsQuery.data.items
    : [];
  const selectedAgentTitle =
    String(
      props.agentCatalog.find((item: any) => item.type === state.agentType)?.title ??
        '',
    ).trim() || 'Ação COMGEP';

  const filteredTaskLocalities = useMemo(() => {
    return smifLocalities.filter((item: any) => !focusUf || String(item.uf ?? '').toUpperCase() === focusUf);
  }, [smifLocalities, focusUf]);

  const missionLocalityOptions = useMemo(() => {
    const source = missionForm.scope === 'CIPAVD' ? cipavdLocalities : smifLocalities;
    return source.filter((item: any) => !focusUf || String(item.uf ?? '').toUpperCase() === focusUf);
  }, [cipavdLocalities, focusUf, missionForm.scope, smifLocalities]);

  const handleStartAgent = async (agent: any) => {
    const nextFocus = effectiveFocus;
    await start({
      type: String(agent.type),
      title: String(agent.title ?? 'copiloto COMGEP'),
      uf: props.scopeUf || nextFocus?.uf || null,
      mode,
      focus: nextFocus,
    });
  };

  const handleSendFollowUp = async () => {
    const safeMessage = followUpMessage.trim();
    if (!safeMessage || state.running || !state.sessionId) return;
    await followUp({
      message: safeMessage,
      mode,
      focus: effectiveFocus,
    });
    setFollowUpMessage('');
  };

  const openTaskDialog = (message: CopilotMessage) => {
    const firstPhaseId = String(phases[0]?.id ?? '');
    const defaultDueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    setTaskForm({
      title: buildRecommendationTitle(
        selectedAgentTitle,
        message.focus,
        props.scopeUf,
      ),
      description: `${message.content}\n\nEvidências:\n${buildEvidenceSummary(
        message.evidences,
      )}`,
      phaseId: firstPhaseId,
      dueDate: defaultDueDate,
      priority: 'MEDIUM',
      localityIds: [],
    });
    setTaskDialogMessage(message);
  };

  const openMissionDialog = (message: CopilotMessage) => {
    const today = new Date();
    const inSevenDays = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    setMissionForm({
      title: buildRecommendationTitle('Missão proposta', message.focus, props.scopeUf),
      description: `${message.content}\n\nEvidências:\n${buildEvidenceSummary(
        message.evidences,
      )}`,
      scope: 'SMIF',
      localityId: '',
      startDate: today.toISOString().slice(0, 10),
      endDate: inSevenDays.toISOString().slice(0, 10),
    });
    setMissionDialogMessage(message);
  };

  const openRecommendationDialog = (message: CopilotMessage) => {
    setRecommendationForm({
      title: buildRecommendationTitle(
        selectedAgentTitle,
        message.focus,
        props.scopeUf,
      ),
      summary: message.content,
    });
    setRecommendationDialogMessage(message);
  };

  const submitTask = async () => {
    try {
      await createTaskMutation.mutateAsync(taskForm);
      push({ severity: 'success', message: 'Tarefa criada a partir do copiloto.' });
      setTaskDialogMessage(null);
    } catch (error) {
      push({
        severity: 'error',
        message: parseApiError(error).message ?? 'Não foi possível criar a tarefa.',
      });
    }
  };

  const submitMission = async () => {
    try {
      await createMissionMutation.mutateAsync(missionForm);
      push({ severity: 'success', message: 'Missão proposta criada com sucesso.' });
      setMissionDialogMessage(null);
    } catch (error) {
      push({
        severity: 'error',
        message: parseApiError(error).message ?? 'Não foi possível criar a missão.',
      });
    }
  };

  const submitRecommendation = async () => {
    const message = recommendationDialogMessage;
    if (!message) return;
    try {
      const omId = message.evidences.find((item) => item.omId)?.omId ?? null;
      await createRecommendationMutation.mutateAsync({
        title: recommendationForm.title,
        summary: recommendationForm.summary,
        sessionId: state.sessionId,
        sourceAgentType: state.agentType || 'briefing_comgep',
        mode,
        focusType: message.focus?.kind ?? null,
        focusLabel: describeCopilotFocus(message.focus, props.scopeUf),
        uf: message.focus?.uf ?? (focusUf || null),
        omId,
        evidence: message.evidences,
      });
      push({ severity: 'success', message: 'Recomendação registrada para acompanhamento.' });
      setRecommendationDialogMessage(null);
    } catch (error) {
      push({
        severity: 'error',
        message:
          parseApiError(error).message ??
          'Não foi possível registrar a recomendação.',
      });
    }
  };

  const exportSessionPdf = async () => {
    if (!state.sessionId) return;
    try {
      await exportPdfMutation.mutateAsync({ sessionId: state.sessionId });
    } catch (error) {
      push({
        severity: 'error',
        message: parseApiError(error).message ?? 'Não foi possível gerar o PDF.',
      });
    }
  };

  return (
    <>
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={1.5}>
              <Box>
                <Typography variant="h6" fontWeight={800}>
                  Copiloto COMGEP contextual
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.6 }}>
                  Conversa guiada com memória de sessão, foco clicável vindo da tela e respostas com evidências OM/UF prontas para ação.
                </Typography>
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={mode}
                  onChange={(_event, value) => {
                    if (value) setMode(value);
                  }}
                >
                  <ToggleButton value="executive">Executivo</ToggleButton>
                  <ToggleButton value="analyst">Analista</ToggleButton>
                </ToggleButtonGroup>
                <TextField
                  size="small"
                  select
                  label="Escopo do copiloto"
                  value={props.scopeUf}
                  onChange={(event) => {
                    const nextUf = event.target.value;
                    props.onScopeUfChange(nextUf);
                    if (!nextUf) {
                      props.onFocusChange(null);
                      return;
                    }
                    if (!props.focus || props.focus.kind === 'uf' || props.focus.kind === 'overview') {
                      props.onFocusChange({
                        kind: 'uf',
                        label: `UF ${nextUf}`,
                        description: `Leitura concentrada na UF ${nextUf}.`,
                        uf: nextUf,
                      });
                    }
                  }}
                  sx={{ minWidth: 220 }}
                >
                  <MenuItem value="">Visão nacional</MenuItem>
                  {props.matrixItems.map((item: any) => (
                    <MenuItem key={item.uf} value={item.uf}>
                      {item.uf} · {item.priorityBand}
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  variant="text"
                  color="inherit"
                  onClick={() => {
                    props.onScopeUfChange('');
                    props.onFocusChange(null);
                    reset();
                  }}
                  startIcon={<RestartAltRoundedIcon />}
                >
                  Limpar sessão
                </Button>
              </Stack>
            </Stack>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip
                color="primary"
                variant="outlined"
                label={`Foco atual: ${describeCopilotFocus(effectiveFocus, props.scopeUf)}`}
              />
              {state.sessionId ? (
                <Chip
                  variant="outlined"
                  label={`Sessão ${state.sessionId.slice(0, 8)}`}
                />
              ) : null}
              {state.model ? <Chip variant="outlined" label={`Modelo: ${state.model}`} /> : null}
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, minmax(0, 1fr))' },
                gap: 2,
              }}
            >
              {props.agentCatalog.map((agent: any) => (
                <Card
                  key={agent.type}
                  variant="outlined"
                  sx={{ borderRadius: 3, borderTop: '4px solid #1A3C6E' }}
                >
                  <CardContent>
                    <Stack spacing={1.2}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <AutoAwesomeRoundedIcon sx={{ color: '#1A3C6E' }} />
                        <Typography variant="subtitle1" fontWeight={800}>
                          {agent.title}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {agent.description}
                      </Typography>
                      <Button
                        variant="contained"
                        onClick={() => handleStartAgent(agent)}
                        disabled={state.running}
                        startIcon={<AutoAwesomeRoundedIcon />}
                        sx={{ alignSelf: 'flex-start' }}
                      >
                        {state.running && state.agentType === agent.type ? 'Executando...' : 'Executar agente'}
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.55fr) minmax(340px, 0.9fr)' },
                gap: 2,
              }}
            >
              <Card variant="outlined" sx={{ borderRadius: 3, minHeight: 520 }}>
                <CardContent>
                  <Stack spacing={2}>
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      justifyContent="space-between"
                      spacing={1}
                    >
                      <Box>
                        <Typography variant="subtitle1" fontWeight={800}>
                          Conversa operacional
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          O copiloto usa a sessão corrente para responder follow-ups como comparação entre UFs, filtragem de OMs sem CPCA e impacto das ações sugeridas.
                        </Typography>
                      </Box>
                      {state.generatedAt ? (
                        <Chip
                          variant="outlined"
                          label={`Última resposta ${formatDateTime(state.generatedAt)}`}
                        />
                      ) : null}
                    </Stack>

                    {state.running ? (
                      <Box>
                        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.8 }}>
                          <Typography variant="caption" color="text.secondary">
                            {state.stage}
                          </Typography>
                          <Typography variant="caption" fontWeight={700}>
                            {state.percent}%
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={state.percent}
                          sx={{ height: 8, borderRadius: 999 }}
                        />
                      </Box>
                    ) : null}

                    {state.error ? <Alert severity="error">{state.error}</Alert> : null}

                    {state.messages.length === 0 ? (
                      <Alert severity="info" variant="outlined">
                        Selecione um foco na tela e execute um dos agentes. Depois disso você pode fazer follow-ups livres, mantendo a memória da sessão ativa.
                      </Alert>
                    ) : (
                      <Stack spacing={1.5}>
                        {state.messages.map((message) => {
                          const isLatestAssistant =
                            message.role === 'assistant' &&
                            latestAssistantMessage?.id === message.id;
                          return (
                            <Paper
                              key={message.id}
                              variant="outlined"
                              sx={{
                                p: 2,
                                borderRadius: 3,
                                bgcolor: message.role === 'assistant' ? '#FAFBFD' : '#FFFFFF',
                                borderColor: message.role === 'assistant' ? '#D7DEE9' : '#E5E7EB',
                              }}
                            >
                              <Stack spacing={1.2}>
                                <Stack
                                  direction={{ xs: 'column', md: 'row' }}
                                  justifyContent="space-between"
                                  spacing={1}
                                >
                                  <Stack direction="row" spacing={1} alignItems="center">
                                    <Chip
                                      size="small"
                                      color={message.role === 'assistant' ? 'primary' : 'default'}
                                      label={message.role === 'assistant' ? 'Copiloto' : 'Você'}
                                    />
                                    <Typography variant="caption" color="text.secondary">
                                      {describeCopilotFocus(message.focus, props.scopeUf)}
                                    </Typography>
                                  </Stack>
                                  <Typography variant="caption" color="text.secondary">
                                    {formatDateTime(message.createdAt)}
                                  </Typography>
                                </Stack>

                                {message.role === 'assistant' ? (
                                  <MarkdownPanel content={message.content} />
                                ) : (
                                  <Typography variant="body2">{message.content}</Typography>
                                )}

                                {message.role === 'assistant' && message.evidences.length > 0 ? (
                                  <Table size="small">
                                    <TableHead>
                                      <TableRow>
                                        <TableCell>OM</TableCell>
                                        <TableCell>UF</TableCell>
                                        <TableCell align="right">Score</TableCell>
                                        <TableCell>Motivo</TableCell>
                                        <TableCell align="right">Abrir</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {message.evidences.slice(0, 6).map((item) => (
                                        <TableRow key={item.id} hover>
                                          <TableCell>
                                            <Typography variant="subtitle2" fontWeight={700}>
                                              {item.omCode}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                              {item.coverageType || item.omName}
                                            </Typography>
                                          </TableCell>
                                          <TableCell>{item.uf}</TableCell>
                                          <TableCell align="right">{item.score}</TableCell>
                                          <TableCell>{item.reason}</TableCell>
                                          <TableCell align="right">
                                            <IconButton
                                              size="small"
                                              component="a"
                                              href={item.link}
                                              target="_blank"
                                              rel="noreferrer"
                                            >
                                              <OpenInNewRoundedIcon fontSize="small" />
                                            </IconButton>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                ) : null}

                                {isLatestAssistant ? (
                                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                    {canCreateTask ? (
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        startIcon={<AddTaskRoundedIcon />}
                                        onClick={() => openTaskDialog(message)}
                                      >
                                        Criar tarefa
                                      </Button>
                                    ) : null}
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      startIcon={<PictureAsPdfRoundedIcon />}
                                      onClick={exportSessionPdf}
                                      disabled={!state.sessionId || exportPdfMutation.isPending}
                                    >
                                      Gerar briefing PDF
                                    </Button>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      startIcon={<PlaylistPlayRoundedIcon />}
                                      onClick={() => setEvidenceDialogMessage(message)}
                                      disabled={!message.evidences.length}
                                    >
                                      Abrir lista das OMs
                                    </Button>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      startIcon={<FactCheckRoundedIcon />}
                                      onClick={() => openRecommendationDialog(message)}
                                    >
                                      Registrar recomendação
                                    </Button>
                                    {canCreateMission ? (
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        startIcon={<RocketLaunchRoundedIcon />}
                                        onClick={() => openMissionDialog(message)}
                                      >
                                        Propor missão
                                      </Button>
                                    ) : null}
                                  </Stack>
                                ) : null}
                              </Stack>
                            </Paper>
                          );
                        })}

                        {state.running && state.draft ? (
                          <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, bgcolor: '#FAFBFD' }}>
                            <Typography variant="caption" color="text.secondary">
                              Copiloto escrevendo...
                            </Typography>
                            <MarkdownPanel content={state.draft} />
                          </Paper>
                        ) : null}
                      </Stack>
                    )}

                    <Divider />

                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2}>
                      <TextField
                        fullWidth
                        multiline
                        minRows={2}
                        label="Follow-up contextual"
                        placeholder="Ex.: por que SP ficou acima de DF? • Mostre só OMs sem CPCA no RJ • Qual dessas ações gera mais impacto?"
                        value={followUpMessage}
                        onChange={(event) => setFollowUpMessage(event.target.value)}
                        disabled={!state.sessionId || state.running}
                      />
                      <Button
                        variant="contained"
                        onClick={handleSendFollowUp}
                        disabled={!state.sessionId || state.running || !followUpMessage.trim()}
                        startIcon={<SendRoundedIcon />}
                        sx={{ minWidth: 180 }}
                      >
                        Enviar
                      </Button>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>

              <Stack spacing={2}>
                <Card variant="outlined" sx={{ borderRadius: 3 }}>
                  <CardContent>
                    <Typography variant="h6" fontWeight={800} sx={{ mb: 1.2 }}>
                      Contexto ativo do copiloto
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.4 }}>
                      O gestor consegue apontar o foco da conversa diretamente a partir dos KPI, UFs e OMs abertas na Sala COMGEP.
                    </Typography>
                    <Stack spacing={1}>
                      <Chip
                        color="primary"
                        variant="outlined"
                        label={`Modo: ${mode === 'analyst' ? 'Analista' : 'Executivo'}`}
                      />
                      <Chip
                        variant="outlined"
                        label={`Foco: ${describeCopilotFocus(effectiveFocus, props.scopeUf)}`}
                      />
                      <Chip
                        variant="outlined"
                        label={`Escopo: ${props.scopeUf ? `UF ${props.scopeUf}` : 'Nacional'}`}
                      />
                    </Stack>
                  </CardContent>
                </Card>

                <Card variant="outlined" sx={{ borderRadius: 3 }}>
                  <CardContent>
                    <Typography variant="h6" fontWeight={800} sx={{ mb: 1.2 }}>
                      Recomendações registradas
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.4 }}>
                      Últimos encaminhamentos formalizados a partir do copiloto, preservando foco, modo e evidências vinculadas.
                    </Typography>
                    <Stack spacing={1.2}>
                      {recommendations.length === 0 ? (
                        <Alert severity="info" variant="outlined">
                          Ainda não existem recomendações registradas na Sala COMGEP.
                        </Alert>
                      ) : (
                        recommendations.map((item: any) => (
                          <Paper key={item.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                            <Typography variant="subtitle2" fontWeight={800}>
                              {item.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.4 }}>
                              {item.sourceAgentType} • {item.mode === 'analyst' ? 'Analista' : 'Executivo'} • {formatDateTime(item.createdAt)}
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 0.8 }}>
                              {String(item.summary ?? '').slice(0, 220)}
                              {String(item.summary ?? '').length > 220 ? '…' : ''}
                            </Typography>
                          </Paper>
                        ))
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </Stack>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Dialog open={Boolean(taskDialogMessage)} onClose={() => setTaskDialogMessage(null)} maxWidth="md" fullWidth>
        <DialogTitle>Criar tarefa a partir do copiloto</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              label="Título"
              value={taskForm.title}
              onChange={(event) => setTaskForm((prev) => ({ ...prev, title: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Descrição"
              value={taskForm.description}
              onChange={(event) => setTaskForm((prev) => ({ ...prev, description: event.target.value }))}
              multiline
              minRows={5}
              fullWidth
            />
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                select
                label="Fase"
                value={taskForm.phaseId}
                onChange={(event) => setTaskForm((prev) => ({ ...prev, phaseId: event.target.value }))}
                fullWidth
              >
                {phases.map((phase: any) => (
                  <MenuItem key={phase.id} value={phase.id}>
                    {phase.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                type="date"
                label="Prazo"
                value={taskForm.dueDate}
                onChange={(event) => setTaskForm((prev) => ({ ...prev, dueDate: event.target.value }))}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                select
                label="Prioridade"
                value={taskForm.priority}
                onChange={(event) => setTaskForm((prev) => ({ ...prev, priority: event.target.value }))}
                fullWidth
              >
                <MenuItem value="LOW">Baixa</MenuItem>
                <MenuItem value="MEDIUM">Média</MenuItem>
                <MenuItem value="HIGH">Alta</MenuItem>
              </TextField>
            </Stack>
            <Autocomplete
              multiple
              options={filteredTaskLocalities}
              value={filteredTaskLocalities.filter((item: any) => taskForm.localityIds.includes(item.id))}
              getOptionLabel={(option: any) =>
                `${option.code ? `${option.code} · ` : ''}${option.name}${option.uf ? ` (${option.uf})` : ''}`
              }
              onChange={(_event, value) =>
                setTaskForm((prev) => ({
                  ...prev,
                  localityIds: value.map((item: any) => item.id),
                }))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Localidades SMIF relacionadas"
                  helperText={
                    focusUf
                      ? `Mostrando localidades SMIF da UF ${focusUf}.`
                      : 'Selecione as localidades SMIF onde a ação deve ser acompanhada.'
                  }
                />
              )}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTaskDialogMessage(null)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={submitTask}
            disabled={
              createTaskMutation.isPending ||
              !taskForm.title.trim() ||
              !taskForm.phaseId ||
              !taskForm.dueDate ||
              taskForm.localityIds.length === 0
            }
          >
            Criar tarefa
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(missionDialogMessage)} onClose={() => setMissionDialogMessage(null)} maxWidth="md" fullWidth>
        <DialogTitle>Propor missão a partir do copiloto</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              label="Título"
              value={missionForm.title}
              onChange={(event) => setMissionForm((prev) => ({ ...prev, title: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Descrição"
              value={missionForm.description}
              onChange={(event) => setMissionForm((prev) => ({ ...prev, description: event.target.value }))}
              multiline
              minRows={5}
              fullWidth
            />
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                select
                label="Escopo"
                value={missionForm.scope}
                onChange={(event) =>
                  setMissionForm((prev) => ({
                    ...prev,
                    scope: event.target.value as 'SMIF' | 'CIPAVD',
                    localityId: '',
                  }))
                }
                fullWidth
              >
                <MenuItem value="SMIF">SMIF</MenuItem>
                <MenuItem value="CIPAVD">CIPAVD</MenuItem>
              </TextField>
              <TextField
                type="date"
                label="Início"
                value={missionForm.startDate}
                onChange={(event) => setMissionForm((prev) => ({ ...prev, startDate: event.target.value }))}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                type="date"
                label="Fim"
                value={missionForm.endDate}
                onChange={(event) => setMissionForm((prev) => ({ ...prev, endDate: event.target.value }))}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Stack>
            <Autocomplete
              options={missionLocalityOptions}
              value={missionLocalityOptions.find((item: any) => item.id === missionForm.localityId) ?? null}
              getOptionLabel={(option: any) =>
                `${option.code ? `${option.code} · ` : ''}${option.name}${option.uf ? ` (${option.uf})` : ''}`
              }
              onChange={(_event, value) =>
                setMissionForm((prev) => ({
                  ...prev,
                  localityId: value?.id ?? '',
                }))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={`Localidade ${missionForm.scope}`}
                  helperText={
                    focusUf
                      ? `Mostrando localidades ${missionForm.scope} da UF ${focusUf}.`
                      : `Selecione a localidade ${missionForm.scope} para a missão.`
                  }
                />
              )}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMissionDialogMessage(null)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={submitMission}
            disabled={
              createMissionMutation.isPending ||
              !missionForm.title.trim() ||
              !missionForm.localityId ||
              !missionForm.startDate ||
              !missionForm.endDate
            }
          >
            Criar missão
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(recommendationDialogMessage)}
        onClose={() => setRecommendationDialogMessage(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Registrar recomendação</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              label="Título"
              value={recommendationForm.title}
              onChange={(event) =>
                setRecommendationForm((prev) => ({ ...prev, title: event.target.value }))
              }
              fullWidth
            />
            <TextField
              label="Resumo da recomendação"
              value={recommendationForm.summary}
              onChange={(event) =>
                setRecommendationForm((prev) => ({ ...prev, summary: event.target.value }))
              }
              multiline
              minRows={8}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRecommendationDialogMessage(null)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={submitRecommendation}
            disabled={
              createRecommendationMutation.isPending ||
              !recommendationForm.title.trim() ||
              !recommendationForm.summary.trim()
            }
          >
            Registrar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(evidenceDialogMessage)} onClose={() => setEvidenceDialogMessage(null)} maxWidth="lg" fullWidth>
        <DialogTitle>Lista de OMs vinculadas à resposta</DialogTitle>
        <DialogContent dividers>
          {evidenceDialogMessage?.evidences?.length ? (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>OM</TableCell>
                  <TableCell>UF</TableCell>
                  <TableCell align="right">Score</TableCell>
                  <TableCell>Motivo</TableCell>
                  <TableCell align="right">Abrir</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {evidenceDialogMessage.evidences.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Typography variant="subtitle2" fontWeight={700}>
                        {item.omCode}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.omName}
                      </Typography>
                    </TableCell>
                    <TableCell>{item.uf}</TableCell>
                    <TableCell align="right">{item.score}</TableCell>
                    <TableCell>{item.reason}</TableCell>
                    <TableCell align="right">
                      <Button size="small" href={item.link} target="_blank" rel="noreferrer">
                        <OpenInNewRoundedIcon fontSize="small" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Alert severity="info" variant="outlined">
              Esta resposta não retornou evidências OM estruturadas.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEvidenceDialogMessage(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export function ComgepSituationRoomPage() {
  const roomQuery = useComgepSituationRoom();
  const agentsQuery = useAiActionAgents();
  const [selectedUf, setSelectedUf] = useState('');
  const [copilotFocus, setCopilotFocus] = useState<CopilotFocus | null>(null);
  const [detailUf, setDetailUf] = useState<any | null>(null);
  const [detailKpi, setDetailKpi] = useState<string | null>(null);

  const data = roomQuery.data;
  const matrixItems = Array.isArray(data?.matrix?.items) ? data.matrix.items : [];
  const matrixChartData = useMemo(
    () =>
      matrixItems.map((item: any) => ({
        ...item,
        x: Number(item.coveragePercent ?? 0),
        y: Number(item.riskScore ?? 0),
        z: Math.max(12, Number(item.presenceScore ?? 0) || 12),
      })),
    [matrixItems],
  );

  if (roomQuery.isLoading) return <SkeletonState />;
  if (roomQuery.isError) {
    return <ErrorState error={roomQuery.error} onRetry={() => roomQuery.refetch()} />;
  }

  const summary = data?.summary ?? {};
  const watchlists = data?.watchlists ?? {};
  const criticalUfs = Array.isArray(watchlists?.criticalUfs) ? watchlists.criticalUfs : [];
  const topRiskOms = Array.isArray(watchlists?.topRiskOms) ? watchlists.topRiskOms : [];
  const coverageGaps = Array.isArray(watchlists?.coverageGaps) ? watchlists.coverageGaps : [];
  const operationalPressure = Array.isArray(watchlists?.operationalPressure)
    ? watchlists.operationalPressure
    : [];
  const dataConfidence = data?.dataConfidence ?? {};
  const details = data?.details ?? {};
  const coveredOmsDetails = Array.isArray(details?.coveredOms) ? details.coveredOms : [];
  const criticalUfDetails = Array.isArray(details?.criticalUfs) ? details.criticalUfs : [];
  const highRiskOmDetails = Array.isArray(details?.highRiskOms) ? details.highRiskOms : [];
  const operationalPresenceDetails = Array.isArray(details?.operationalPresenceByUf)
    ? details.operationalPresenceByUf
    : [];
  const agentCatalog = Array.isArray(agentsQuery.data) ? agentsQuery.data : [];

  const detailKpiTitle =
    detailKpi === 'coveredOms'
      ? 'OMs cobertas pela estrutura CPCA'
      : detailKpi === 'criticalUfs'
        ? 'UFs críticas'
        : detailKpi === 'highRiskOms'
          ? 'OMs de maior risco'
          : detailKpi === 'operationalPresence'
            ? 'Presença operacional por UF'
            : '';

  const detailKpiDescription =
    detailKpi === 'coveredOms'
      ? 'Detalha as OMs que já possuem cobertura CPCA efetiva, seja por comissão própria ou por cobertura delegada de outra OM.'
      : detailKpi === 'criticalUfs'
        ? 'Mostra as UFs cuja combinação entre risco, cobertura e presença operacional justificou priorização na Sala COMGEP.'
        : detailKpi === 'highRiskOms'
          ? 'Explica por que cada OM entrou no grupo de maior risco, destacando fatores como denúncias, retaliação, morosidade e sinais BI.'
          : detailKpi === 'operationalPresence'
            ? 'Lista a distribuição da atuação institucional recente por UF, somando missões, atividades concluídas e relatórios assinados.'
            : '';

  return (
    <Box>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" fontWeight={800}>
            Sala de Situação COMGEP
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            Superfície executiva para leitura rápida de risco institucional, cobertura CPCA, presença operacional e confiança do dado analítico. Os blocos abaixo já estão desenhados para decisão, não para exploração genérica.
          </Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mt: 1.5 }}>
            <Chip label={`Atualizado em ${formatDateTime(data?.generatedAt)}`} />
            <Chip color="primary" variant="outlined" label={`Janela operacional: ${Number(data?.lookbackDays ?? 0)} dias`} />
            <Chip
              color={Number(dataConfidence?.supportedCoveragePercent ?? 0) >= 80 ? 'success' : 'warning'}
              variant="outlined"
              label={`Cobertura BI útil: ${formatPercent(dataConfidence?.supportedCoveragePercent)}`}
            />
          </Stack>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(4, minmax(0, 1fr))' },
            gap: 2,
          }}
        >
          <SummaryCard
            icon={<ShieldRoundedIcon />}
            title="OMs cobertas"
            value={`${summary.coveredOms ?? 0}/${summary.totalOms ?? 0}`}
            subtitle={`${formatPercent(summary.coveredOmsPercent)} do catálogo com cobertura CPCA efetiva.`}
            color="#1A3C6E"
            description="Conta as OMs com CPCA próprio e também as OMs cobertas formalmente pela comissão de outra OM."
            onClick={() => {
              setDetailKpi('coveredOms');
              setCopilotFocus({
                kind: 'kpi_covered_oms',
                label: 'OMs cobertas pela CPCA',
                description: 'OMs com CPCA próprio ou cobertura delegada.',
              });
            }}
          />
          <SummaryCard
            icon={<WarningAmberRoundedIcon />}
            title="UFs críticas"
            value={summary.criticalUfCount ?? 0}
            subtitle="UFs com risco alto e cobertura ou presença insuficientes."
            color="#D32F2F"
            description="São as UFs que combinam risco elevado com baixa cobertura institucional ou baixa presença operacional recente."
            onClick={() => {
              setDetailKpi('criticalUfs');
              setCopilotFocus({
                kind: 'kpi_critical_ufs',
                label: 'UFs prioritárias',
                description: 'UFs com risco alto e cobertura ou presença insuficientes.',
                uf: selectedUf || null,
              });
            }}
          />
          <SummaryCard
            icon={<GroupsRoundedIcon />}
            title="OMs de alto risco"
            value={summary.highRiskOmCount ?? 0}
            subtitle="OMs com score elevado a partir de denúncias, sinais BI e cobertura."
            color="#ED6C02"
            description="O score soma denúncias abertas, risco de retaliação, morosidade, sinais das pesquisas e situação de cobertura CPCA."
            onClick={() => {
              setDetailKpi('highRiskOms');
              setCopilotFocus({
                kind: 'kpi_high_risk_oms',
                label: 'OMs de maior risco',
                description: 'Ranking das OMs com maior score composto de risco.',
                uf: selectedUf || null,
              });
            }}
          />
          <SummaryCard
            icon={<HubRoundedIcon />}
            title="Presença operacional"
            value={summary.operationalPresenceEvents ?? 0}
            subtitle="Missões, atividades concluídas e relatórios assinados na janela ativa."
            color="#2E7D32"
            description="Mostra a intensidade da atuação recente nas UFs, somando missões, atividades concluídas e relatórios assinados."
            onClick={() => {
              setDetailKpi('operationalPresence');
              setCopilotFocus({
                kind: 'kpi_operational_presence',
                label: 'Presença operacional',
                description: 'Distribuição recente de missões, atividades e relatórios.',
                uf: selectedUf || null,
              });
            }}
          />
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.65fr) minmax(320px, 0.95fr)' },
            gap: 2,
          }}
        >
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="h6" fontWeight={800}>
                    Matriz Cobertura x Risco x Presença Operacional
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.6 }}>
                    Eixo X: cobertura CPCA. Eixo Y: risco institucional composto. Tamanho da bolha: presença operacional na janela ativa. Clique em um ponto para abrir o detalhamento da UF.
                  </Typography>
                </Box>
                <Box sx={{ width: '100%', height: 420 }}>
                  <ResponsiveContainer>
                    <ScatterChart margin={{ top: 20, right: 24, bottom: 24, left: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <ReferenceLine x={70} stroke="#2E7D32" strokeDasharray="4 4" />
                      <ReferenceLine y={60} stroke="#D32F2F" strokeDasharray="4 4" />
                      <XAxis
                        type="number"
                        dataKey="x"
                        name="Cobertura"
                        domain={[0, 100]}
                        tickFormatter={(value) => `${value}%`}
                      />
                      <YAxis
                        type="number"
                        dataKey="y"
                        name="Risco"
                        domain={[0, 100]}
                      />
                      <ZAxis type="number" dataKey="z" range={[90, 500]} />
                      <RechartsTooltip
                        cursor={{ strokeDasharray: '4 4' }}
                        formatter={(value: any, name: any) => {
                          if (name === 'Cobertura') return [`${value}%`, 'Cobertura'];
                          if (name === 'Risco') return [value, 'Risco'];
                          if (name === 'Presença') return [value, 'Presença'];
                          return [value, name];
                        }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const item = payload[0].payload as any;
                          return (
                            <Card variant="outlined" sx={{ p: 1.5, minWidth: 220 }}>
                              <Typography variant="subtitle2" fontWeight={800}>
                                UF {item.uf}
                              </Typography>
                              <Typography variant="body2">Risco: {item.riskScore}</Typography>
                              <Typography variant="body2">Cobertura: {formatPercent(item.coveragePercent)}</Typography>
                              <Typography variant="body2">Presença: {item.presenceScore}</Typography>
                              <Typography variant="body2">Faixa: {item.priorityBand}</Typography>
                            </Card>
                          );
                        }}
                      />
                      <Scatter
                        name="UFs"
                        data={matrixChartData}
                        fill="#1A3C6E"
                        onClick={(payload: any) => {
                          setDetailUf(payload);
                          setSelectedUf(String(payload?.uf ?? '').trim().toUpperCase());
                          setCopilotFocus({
                            kind: 'uf',
                            uf: String(payload?.uf ?? '').trim().toUpperCase() || null,
                            label: payload?.uf ? `UF ${payload.uf}` : 'UF selecionada',
                            description: payload?.recommendedFocus ?? 'UF selecionada na matriz.',
                          });
                        }}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          <Stack spacing={2}>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={800} sx={{ mb: 1.2 }}>
                  UFs prioritárias
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.4 }}>
                  Lista as UFs que exigem atenção do gestor porque concentram risco relevante e, ao mesmo tempo, ainda não estão suficientemente protegidas por cobertura CPCA ou presença operacional.
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>UF</TableCell>
                      <TableCell align="right">Risco</TableCell>
                      <TableCell align="right">Cob.</TableCell>
                      <TableCell align="right">Ver</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {criticalUfs.slice(0, 6).map((item: any) => (
                      <TableRow key={item.uf} hover>
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="subtitle2" fontWeight={700}>{item.uf}</Typography>
                            <Chip size="small" color={resolvePriorityColor(item.priorityBand) as any} label={item.priorityBand} />
                          </Stack>
                        </TableCell>
                        <TableCell align="right">{item.riskScore}</TableCell>
                        <TableCell align="right">{formatPercent(item.coveragePercent)}</TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            onClick={() => {
                              setDetailUf(item);
                              setSelectedUf(String(item?.uf ?? '').trim().toUpperCase());
                              setCopilotFocus({
                                kind: 'uf',
                                uf: String(item?.uf ?? '').trim().toUpperCase() || null,
                                label: item?.uf ? `UF ${item.uf}` : 'UF selecionada',
                                description: item?.recommendedFocus ?? 'UF prioritária selecionada.',
                              });
                            }}
                          >
                            <VisibilityRoundedIcon fontSize="small" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={800} sx={{ mb: 1.2 }}>
                  Confiança do dado
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.2 }}>
                  Mede o quanto a base BI já consegue ser vinculada com segurança a OM ou UF. Quanto maior esse indicador, mais robusto é o cruzamento executivo do sistema.
                </Typography>
                <Stack spacing={1.4}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Cobertura BI útil
                    </Typography>
                    <Typography variant="subtitle2" fontWeight={800}>
                      {formatPercent(dataConfidence?.supportedCoveragePercent)}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={Math.max(0, Math.min(100, Number(dataConfidence?.supportedCoveragePercent ?? 0)))}
                    color={Number(dataConfidence?.supportedCoveragePercent ?? 0) >= 80 ? 'success' : 'warning'}
                    sx={{ height: 8, borderRadius: 999 }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    Última atualização de normalização: {formatDateTime(dataConfidence?.lastUpdatedAt)}.
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {buildDataConfidenceExplanation(dataConfidence)}
                  </Typography>
                  <Alert severity={Number(dataConfidence?.supportedCoveragePercent ?? 0) >= 80 ? 'success' : 'warning'} variant="outlined">
                    A sala de situação já expõe a confiança do dado para evitar leitura executiva sobre base frágil.
                  </Alert>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', xl: 'repeat(3, minmax(0, 1fr))' },
            gap: 2,
          }}
        >
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={800} sx={{ mb: 1.2 }}>
                  OMs de maior risco
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.4 }}>
                  O ranking abaixo mostra as OMs com maior score composto de risco. O objetivo não é punir, e sim apontar onde a intervenção institucional tende a ser mais necessária.
                </Typography>
                <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>OM</TableCell>
                    <TableCell align="right">Risco</TableCell>
                    <TableCell align="right">Copiloto</TableCell>
                    <TableCell align="right">Abrir</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {topRiskOms.slice(0, 8).map((item: any) => (
                    <TableRow key={item.id} hover>
                      <TableCell>
                        <Typography variant="subtitle2" fontWeight={700}>{item.code}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.coverageType}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.4 }}>
                          {buildRiskReason(item)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{item.riskScore}</TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          onClick={() => {
                            setSelectedUf(String(item?.uf ?? '').trim().toUpperCase());
                            setCopilotFocus({
                              kind: 'om',
                              omId: item.id,
                              uf: String(item?.uf ?? '').trim().toUpperCase() || null,
                              label: `${item.code} · maior risco`,
                              description: buildRiskReason(item),
                            });
                          }}
                        >
                          <AutoAwesomeRoundedIcon fontSize="small" />
                        </Button>
                      </TableCell>
                      <TableCell align="right">
                        <Button size="small" href={item.link} target="_blank" rel="noreferrer">
                          <OpenInNewRoundedIcon fontSize="small" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={800} sx={{ mb: 1.2 }}>
                  Gaps de cobertura CPCA
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.4 }}>
                  Aqui entram as OMs que ainda não possuem cobertura CPCA suficiente. O gestor usa esse bloco para saber onde a governança da comissão ainda não alcançou o risco existente.
                </Typography>
                <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>OM</TableCell>
                    <TableCell align="right">Risco</TableCell>
                    <TableCell align="right">Casos</TableCell>
                    <TableCell align="right">Copiloto</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {coverageGaps.slice(0, 8).map((item: any) => (
                    <TableRow key={item.id} hover>
                      <TableCell>
                        <Typography variant="subtitle2" fontWeight={700}>{item.code}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.uf || 'UF não informada'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.4 }}>
                          {buildCoverageGapReason(item)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{item.riskScore}</TableCell>
                      <TableCell align="right">{item.complaints?.openCases ?? 0}</TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          onClick={() => {
                            setSelectedUf(String(item?.uf ?? '').trim().toUpperCase());
                            setCopilotFocus({
                              kind: 'coverage_gap',
                              omId: item.id,
                              uf: String(item?.uf ?? '').trim().toUpperCase() || null,
                              label: `${item.code} · gap de cobertura`,
                              description: buildCoverageGapReason(item),
                            });
                          }}
                        >
                          <AutoAwesomeRoundedIcon fontSize="small" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={800} sx={{ mb: 1.2 }}>
                  Pressão operacional
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.4 }}>
                  A pressão operacional compara o tamanho do risco com a intensidade da presença institucional recente. Quanto maior a diferença, maior a necessidade de reforço de atuação.
                </Typography>
                <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>UF</TableCell>
                    <TableCell align="right">Pressão</TableCell>
                    <TableCell align="right">Ver</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {operationalPressure.slice(0, 8).map((item: any) => (
                    <TableRow key={item.uf} hover>
                      <TableCell>
                        <Typography variant="subtitle2" fontWeight={700}>{item.uf}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.recommendedFocus}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.4 }}>
                          {buildPressureReason(item)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{item.pressureScore}</TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          onClick={() => {
                            setDetailUf(item);
                            setSelectedUf(String(item?.uf ?? '').trim().toUpperCase());
                            setCopilotFocus({
                              kind: 'operational_pressure',
                              uf: String(item?.uf ?? '').trim().toUpperCase() || null,
                              label: item?.uf ? `Pressão operacional em ${item.uf}` : 'Pressão operacional',
                              description: item?.recommendedFocus ?? 'UF com pressão operacional elevada.',
                            });
                          }}
                        >
                          <VisibilityRoundedIcon fontSize="small" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Box>

        <ComgepCopilotPanel
          agentCatalog={agentCatalog}
          matrixItems={matrixItems}
          focus={copilotFocus}
          onFocusChange={setCopilotFocus}
          scopeUf={selectedUf}
          onScopeUfChange={setSelectedUf}
        />
      </Stack>

      <Dialog open={Boolean(detailKpi)} onClose={() => setDetailKpi(null)} maxWidth="lg" fullWidth>
        <DialogTitle>{detailKpiTitle}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity="info" variant="outlined">
              {detailKpiDescription}
            </Alert>

            {detailKpi === 'coveredOms' ? (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>OM</TableCell>
                    <TableCell>Tipo de cobertura</TableCell>
                    <TableCell align="right">Risco</TableCell>
                    <TableCell align="right">Abrir</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {coveredOmsDetails.map((item: any) => (
                    <TableRow key={item.id} hover>
                      <TableCell>
                        <Typography variant="subtitle2" fontWeight={700}>{item.code}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.uf || 'UF não informada'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.4 }}>
                          {buildRiskReason(item)}
                        </Typography>
                      </TableCell>
                      <TableCell>{item.coverageType}</TableCell>
                      <TableCell align="right">{item.riskScore}</TableCell>
                      <TableCell align="right">
                        <Button size="small" href={item.link} target="_blank" rel="noreferrer">
                          <OpenInNewRoundedIcon fontSize="small" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}

            {detailKpi === 'criticalUfs' ? (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>UF</TableCell>
                    <TableCell align="right">Risco</TableCell>
                    <TableCell align="right">Cobertura</TableCell>
                    <TableCell align="right">Presença</TableCell>
                    <TableCell>Leitura</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {criticalUfDetails.map((item: any) => (
                    <TableRow key={item.uf} hover>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="subtitle2" fontWeight={700}>{item.uf}</Typography>
                          <Chip size="small" color={resolvePriorityColor(item.priorityBand) as any} label={item.priorityBand} />
                        </Stack>
                      </TableCell>
                      <TableCell align="right">{item.riskScore}</TableCell>
                      <TableCell align="right">{formatPercent(item.coveragePercent)}</TableCell>
                      <TableCell align="right">{item.presenceScore}</TableCell>
                      <TableCell>{buildPriorityUfReason(item)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}

            {detailKpi === 'highRiskOms' ? (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>OM</TableCell>
                    <TableCell>UF</TableCell>
                    <TableCell align="right">Risco</TableCell>
                    <TableCell>Leitura</TableCell>
                    <TableCell align="right">Abrir</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {highRiskOmDetails.map((item: any) => (
                    <TableRow key={item.id} hover>
                      <TableCell>
                        <Typography variant="subtitle2" fontWeight={700}>{item.code}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.coverageType}
                        </Typography>
                      </TableCell>
                      <TableCell>{item.uf || '—'}</TableCell>
                      <TableCell align="right">{item.riskScore}</TableCell>
                      <TableCell>{buildRiskReason(item)}</TableCell>
                      <TableCell align="right">
                        <Button size="small" href={item.link} target="_blank" rel="noreferrer">
                          <OpenInNewRoundedIcon fontSize="small" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}

            {detailKpi === 'operationalPresence' ? (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>UF</TableCell>
                    <TableCell align="right">Eventos</TableCell>
                    <TableCell align="right">Missões</TableCell>
                    <TableCell align="right">Atividades</TableCell>
                    <TableCell align="right">Relatórios</TableCell>
                    <TableCell>Leitura</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {operationalPresenceDetails.map((item: any) => (
                    <TableRow key={item.uf} hover>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="subtitle2" fontWeight={700}>{item.uf}</Typography>
                          <Chip size="small" color={resolvePriorityColor(item.priorityBand) as any} label={item.priorityBand} />
                        </Stack>
                      </TableCell>
                      <TableCell align="right">{item.totalEvents}</TableCell>
                      <TableCell align="right">{item.missions}</TableCell>
                      <TableCell align="right">{item.completedActivities}</TableCell>
                      <TableCell align="right">{item.signedReports}</TableCell>
                      <TableCell>{buildPressureReason(item)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailKpi(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(detailUf)} onClose={() => setDetailUf(null)} maxWidth="lg" fullWidth>
        <DialogTitle>
          Detalhamento da UF {detailUf?.uf ?? ''}
        </DialogTitle>
        <DialogContent dividers>
          {detailUf ? (
            <Stack spacing={2}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(4, minmax(0, 1fr))' },
                  gap: 1.5,
                }}
              >
                <SummaryCard
                  icon={<WarningAmberRoundedIcon />}
                  title="Risco"
                  value={detailUf.riskScore ?? 0}
                  subtitle={detailUf.recommendedFocus ?? '—'}
                  color="#D32F2F"
                />
                <SummaryCard
                  icon={<ShieldRoundedIcon />}
                  title="Cobertura"
                  value={formatPercent(detailUf.coveragePercent)}
                  subtitle={`${detailUf.coveredOms ?? 0}/${detailUf.totalOms ?? 0} OMs cobertas`}
                  color="#1A3C6E"
                />
                <SummaryCard
                  icon={<TrendingUpRoundedIcon />}
                  title="Presença"
                  value={detailUf.presenceScore ?? 0}
                  subtitle={`Missões: ${detailUf.presence?.missions ?? 0} · Atividades: ${detailUf.presence?.completedActivities ?? 0}`}
                  color="#2E7D32"
                />
                <SummaryCard
                  icon={<GroupsRoundedIcon />}
                  title="Denúncias abertas"
                  value={detailUf.complaints?.openCases ?? 0}
                  subtitle={`Risco de retaliação: ${detailUf.complaints?.retaliationCases ?? 0}`}
                  color="#ED6C02"
                />
              </Box>

              <Divider />

              <Typography variant="h6" fontWeight={800}>
                OMs priorizadas na UF
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>OM</TableCell>
                    <TableCell align="right">Risco</TableCell>
                    <TableCell align="right">Cobertura</TableCell>
                    <TableCell align="right">Abrir</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(Array.isArray(detailUf.oms) ? detailUf.oms : []).slice(0, 12).map((item: any) => (
                    <TableRow key={item.id} hover>
                      <TableCell>
                        <Typography variant="subtitle2" fontWeight={700}>{item.code}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.coverageType}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{item.riskScore}</TableCell>
                      <TableCell align="right">{item.covered ? 'Coberta' : 'Sem cobertura'}</TableCell>
                      <TableCell align="right">
                        <Button size="small" href={item.link} target="_blank" rel="noreferrer">
                          <OpenInNewRoundedIcon fontSize="small" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailUf(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
