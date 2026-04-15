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

function SummaryCard({
  icon,
  title,
  value,
  subtitle,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  subtitle: string;
  color: string;
}) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3, borderTop: `4px solid ${color}` }}>
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
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        let currentEvent = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (currentEvent === 'progress') {
                setState((prev) => ({
                  ...prev,
                  percent: data.percent ?? prev.percent,
                  stage: data.stage ?? prev.stage,
                }));
              } else if (currentEvent === 'token') {
                setState((prev) => ({
                  ...prev,
                  percent: data.percent ?? prev.percent,
                  narrative: prev.narrative + (data.text ?? ''),
                }));
              } else if (currentEvent === 'done') {
                setState((prev) => ({
                  ...prev,
                  running: false,
                  percent: 100,
                  narrative: data.narrative ?? prev.narrative,
                  model: data.model ?? '',
                  generatedAt: data.generatedAt ?? '',
                }));
              } else if (currentEvent === 'error') {
                setState((prev) => ({
                  ...prev,
                  running: false,
                  error: data.message ?? 'Erro desconhecido',
                }));
              }
            } catch {}
          }
        }
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

  if (roomQuery.isLoading) return <SkeletonState />;
  if (roomQuery.isError) {
    return <ErrorState error={roomQuery.error} onRetry={() => roomQuery.refetch()} />;
  }

  const data = roomQuery.data;
  const summary = data?.summary ?? {};
  const matrixItems = Array.isArray(data?.matrix?.items) ? data.matrix.items : [];
  const watchlists = data?.watchlists ?? {};
  const criticalUfs = Array.isArray(watchlists?.criticalUfs) ? watchlists.criticalUfs : [];
  const topRiskOms = Array.isArray(watchlists?.topRiskOms) ? watchlists.topRiskOms : [];
  const coverageGaps = Array.isArray(watchlists?.coverageGaps) ? watchlists.coverageGaps : [];
  const operationalPressure = Array.isArray(watchlists?.operationalPressure)
    ? watchlists.operationalPressure
    : [];
  const dataConfidence = data?.dataConfidence ?? {};
  const agentCatalog = Array.isArray(agentsQuery.data) ? agentsQuery.data : [];

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
          />
          <SummaryCard
            icon={<WarningAmberRoundedIcon />}
            title="UFs críticas"
            value={summary.criticalUfCount ?? 0}
            subtitle="UFs com risco alto e cobertura ou presença insuficientes."
            color="#D32F2F"
          />
          <SummaryCard
            icon={<GroupsRoundedIcon />}
            title="OMs de alto risco"
            value={summary.highRiskOmCount ?? 0}
            subtitle="OMs com score elevado a partir de denúncias, sinais BI e cobertura."
            color="#ED6C02"
          />
          <SummaryCard
            icon={<HubRoundedIcon />}
            title="Presença operacional"
            value={summary.operationalPresenceEvents ?? 0}
            subtitle="Missões, atividades concluídas e relatórios assinados na janela ativa."
            color="#2E7D32"
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
