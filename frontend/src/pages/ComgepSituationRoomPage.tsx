import {
  Alert,
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
  LinearProgress,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
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
import { useAiActionAgents, useComgepSituationRoom } from '../api/hooks';
import { consumeJsonSseStream } from '../app/sse';
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

type AgentState = {
  running: boolean;
  percent: number;
  stage: string;
  narrative: string;
  model: string;
  generatedAt: string;
  error: string;
  type: string;
};

function useActionAgentRunner() {
  const abortRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<AgentState>({
    running: false,
    percent: 0,
    stage: '',
    narrative: '',
    model: '',
    generatedAt: '',
    error: '',
    type: '',
  });

  const start = async (type: string, uf?: string) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({
      running: true,
      percent: 0,
      stage: 'Iniciando...',
      narrative: '',
      model: '',
      generatedAt: '',
      error: '',
      type,
    });

    try {
      const res = await fetch(`${getBaseUrl()}/ai/action-agents/run`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ type, uf: uf || null }),
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
            narrative: prev.narrative + (data.text ?? ''),
          }));
          return;
        }

        if (event === 'done') {
          sawTerminalEvent = true;
          setState((prev) => ({
            ...prev,
            running: false,
            percent: 100,
            narrative: data.narrative ?? prev.narrative,
            model: data.model ?? '',
            generatedAt: data.generatedAt ?? '',
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
            prev.narrative.trim() || prev.error
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

  return { state, start };
}

export function ComgepSituationRoomPage() {
  const roomQuery = useComgepSituationRoom();
  const agentsQuery = useAiActionAgents();
  const { state: agentState, start: runAgent } = useActionAgentRunner();
  const [selectedUf, setSelectedUf] = useState('');
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
            onClick={() => setDetailKpi('coveredOms')}
          />
          <SummaryCard
            icon={<WarningAmberRoundedIcon />}
            title="UFs críticas"
            value={summary.criticalUfCount ?? 0}
            subtitle="UFs com risco alto e cobertura ou presença insuficientes."
            color="#D32F2F"
            description="São as UFs que combinam risco elevado com baixa cobertura institucional ou baixa presença operacional recente."
            onClick={() => setDetailKpi('criticalUfs')}
          />
          <SummaryCard
            icon={<GroupsRoundedIcon />}
            title="OMs de alto risco"
            value={summary.highRiskOmCount ?? 0}
            subtitle="OMs com score elevado a partir de denúncias, sinais BI e cobertura."
            color="#ED6C02"
            description="O score soma denúncias abertas, risco de retaliação, morosidade, sinais das pesquisas e situação de cobertura CPCA."
            onClick={() => setDetailKpi('highRiskOms')}
          />
          <SummaryCard
            icon={<HubRoundedIcon />}
            title="Presença operacional"
            value={summary.operationalPresenceEvents ?? 0}
            subtitle="Missões, atividades concluídas e relatórios assinados na janela ativa."
            color="#2E7D32"
            description="Mostra a intensidade da atuação recente nas UFs, somando missões, atividades concluídas e relatórios assinados."
            onClick={() => setDetailKpi('operationalPresence')}
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
                        onClick={(payload: any) => setDetailUf(payload)}
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
                          <Button size="small" onClick={() => setDetailUf(item)}>
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
                        <Button size="small" onClick={() => setDetailUf(item)}>
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

        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
                <Box>
                  <Typography variant="h6" fontWeight={800}>
                    Agentes de IA orientados à ação
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.6 }}>
                    Cada agente usa a mesma base da Sala COMGEP. O objetivo aqui é gerar briefing, priorização e encaminhamento executivo, não conversa genérica.
                  </Typography>
                </Box>
                <TextField
                  size="small"
                  select
                  label="Escopo do agente"
                  value={selectedUf}
                  onChange={(event) => setSelectedUf(event.target.value)}
                  sx={{ minWidth: 220 }}
                >
                  <MenuItem value="">Visão nacional</MenuItem>
                  {matrixItems.map((item: any) => (
                    <MenuItem key={item.uf} value={item.uf}>
                      {item.uf} · {item.priorityBand}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, minmax(0, 1fr))' },
                  gap: 2,
                }}
              >
                {agentCatalog.map((agent: any) => (
                  <Card key={agent.type} variant="outlined" sx={{ borderRadius: 3, borderTop: '4px solid #1A3C6E' }}>
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
                          onClick={() => runAgent(String(agent.type), selectedUf || undefined)}
                          disabled={agentState.running}
                          startIcon={<AutoAwesomeRoundedIcon />}
                          sx={{ alignSelf: 'flex-start' }}
                        >
                          {agentState.running && agentState.type === agent.type ? 'Executando...' : 'Executar agente'}
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Box>

              {(agentState.running || agentState.narrative || agentState.error) && (
                <Card variant="outlined" sx={{ borderRadius: 3, bgcolor: '#FAFBFD' }}>
                  <CardContent>
                    <Stack spacing={1.5}>
                      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
                        <Box>
                          <Typography variant="subtitle1" fontWeight={800}>
                            Saída do agente {agentState.type ? `· ${agentState.type}` : ''}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Escopo: {selectedUf || 'visão nacional'}
                          </Typography>
                        </Box>
                        {agentState.model ? (
                          <Chip size="small" label={`Modelo: ${agentState.model}`} />
                        ) : null}
                      </Stack>

                      {agentState.running && (
                        <Box>
                          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.8 }}>
                            <Typography variant="caption" color="text.secondary">
                              {agentState.stage}
                            </Typography>
                            <Typography variant="caption" fontWeight={700}>
                              {agentState.percent}%
                            </Typography>
                          </Stack>
                          <LinearProgress variant="determinate" value={agentState.percent} sx={{ height: 8, borderRadius: 999 }} />
                        </Box>
                      )}

                      {agentState.error ? (
                        <Alert severity="error">{agentState.error}</Alert>
                      ) : null}

                      {agentState.narrative ? <MarkdownPanel content={agentState.narrative} /> : null}
                    </Stack>
                  </CardContent>
                </Card>
              )}
            </Stack>
          </CardContent>
        </Card>
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
