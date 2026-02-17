import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Drawer,
  Divider,
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
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useExecutiveDashboard, useMe } from '../api/hooks';
import { SkeletonState } from '../components/states/SkeletonState';
import { ErrorState } from '../components/states/ErrorState';
import { EmptyState } from '../components/states/EmptyState';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar } from 'recharts';
import { can } from '../app/rbac';
import { ACTIVITY_STATUS_LABELS, TASK_STATUS_LABELS } from '../constants/enums';

type DetailView =
  | { type: 'progress' }
  | { type: 'late' }
  | { type: 'unassigned' }
  | { type: 'blocked' }
  | { type: 'lateWeek'; week: string }
  | { type: 'threshold'; phaseId: string }
  | { type: 'leadTime'; phaseId: string }
  | { type: 'reports' }
  | { type: 'risk'; localityId: string };

const dayMs = 1000 * 60 * 60 * 24;

function formatDate(value: string | Date | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('pt-BR');
}

function formatStatus(value: string | null | undefined) {
  if (!value) return '-';
  return TASK_STATUS_LABELS[value] ?? ACTIVITY_STATUS_LABELS[value] ?? value;
}

export function DashboardExecutivePage() {
  const { data: me } = useMe();
  const [params, setParams] = useSearchParams();
  const [detailView, setDetailView] = useState<DetailView | null>(null);
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const threshold = params.get('threshold') ?? '70';
  const command = params.get('command') ?? '';

  const filters = useMemo(
    () => ({
      from: from || undefined,
      to: to || undefined,
      threshold: threshold || undefined,
      command: command || undefined,
    }),
    [from, to, threshold, command],
  );

  const dashboardQuery = useExecutiveDashboard(filters);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  const data = dashboardQuery.data;
  const riskTop10 = data?.risk?.top10 ?? [];
  const lateItems = data?.late?.items ?? [];
  const unassignedItems = data?.unassigned?.items ?? [];
  const blockedItems = data?.blocked?.items ?? [];
  const pendingReportItems = data?.reportsCompliance?.pendingItems ?? [];
  const trend = data?.late?.trend ?? [];
  const thresholdByPhase = data?.localityAboveThreshold ?? [];
  const leadTimeByPhase = data?.leadTime ?? [];
  const progressByPhase = data?.progress?.byPhase ?? [];
  const progressByLocality = data?.progress?.byLocality ?? [];

  const downloadCsv = () => {
    const headers = ['localityCode', 'score', 'late', 'blocked', 'unassigned', 'reportPending'];
    const rows = riskTop10.map((item: any) => [
      item.localityCode,
      item.score,
      item.breakdown?.late ?? 0,
      item.breakdown?.blocked ?? 0,
      item.breakdown?.unassigned ?? 0,
      item.breakdown?.reportPending ?? 0,
    ]);
    const csv = [headers.join(','), ...rows.map((row: any[]) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'executive-dashboard.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const lateByLocality = useMemo(() => {
    const map = new Map<string, { localityId: string; localityCode: string; localityName: string; count: number }>();
    for (const item of lateItems) {
      const key = item.localityId ?? item.localityCode ?? item.localityName;
      if (!key) continue;
      const current = map.get(key);
      if (current) {
        current.count += 1;
        continue;
      }
      map.set(key, {
        localityId: item.localityId ?? '',
        localityCode: item.localityCode ?? '',
        localityName: item.localityName ?? '',
        count: 1,
      });
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [lateItems]);

  const openLateWeekDetails = (week: string) => setDetailView({ type: 'lateWeek', week });

  const handleLateTrendClick = (payload: any) => {
    const week = payload?.week ?? payload?.payload?.week ?? null;
    if (week) openLateWeekDetails(week);
  };

  const handleThresholdClick = (payload: any) => {
    const phaseId = payload?.phaseId ?? payload?.payload?.phaseId ?? null;
    if (phaseId) setDetailView({ type: 'threshold', phaseId });
  };

  const handleLeadTimeClick = (payload: any) => {
    const phaseId = payload?.phaseId ?? payload?.payload?.phaseId ?? null;
    if (phaseId) setDetailView({ type: 'leadTime', phaseId });
  };

  const weeklyDetails = useMemo(() => {
    if (detailView?.type !== 'lateWeek') return { trendPoint: null as any, tasks: [] as any[] };
    const trendPoint = trend.find((entry: any) => entry.week === detailView.week) ?? null;
    const weekStart = new Date(`${detailView.week}T00:00:00`);
    const weekEnd = new Date(weekStart.getTime() + 7 * dayMs);
    const tasks = lateItems.filter((item: any) => {
      const due = new Date(item.dueDate);
      return due >= weekStart && due < weekEnd;
    });
    return { trendPoint, tasks };
  }, [detailView, trend, lateItems]);

  const selectedThresholdPhase = useMemo(() => {
    if (detailView?.type !== 'threshold') return null;
    return thresholdByPhase.find((entry: any) => entry.phaseId === detailView.phaseId) ?? null;
  }, [detailView, thresholdByPhase]);

  const selectedLeadPhase = useMemo(() => {
    if (detailView?.type !== 'leadTime') return null;
    return leadTimeByPhase.find((entry: any) => entry.phaseId === detailView.phaseId) ?? null;
  }, [detailView, leadTimeByPhase]);

  const selectedRiskItem = useMemo(() => {
    if (detailView?.type !== 'risk') return null;
    return riskTop10.find((entry: any) => entry.localityId === detailView.localityId) ?? null;
  }, [detailView, riskTop10]);

  const selectedRiskRank = useMemo(() => {
    if (detailView?.type !== 'risk') return null;
    const index = riskTop10.findIndex((entry: any) => entry.localityId === detailView.localityId);
    return index >= 0 ? index + 1 : null;
  }, [detailView, riskTop10]);

  const riskLocalityLateItems = useMemo(() => {
    if (!selectedRiskItem) return [];
    return lateItems.filter((item: any) => item.localityId === selectedRiskItem.localityId);
  }, [selectedRiskItem, lateItems]);

  const riskLocalityBlockedItems = useMemo(() => {
    if (!selectedRiskItem) return [];
    return blockedItems.filter((item: any) => item.localityId === selectedRiskItem.localityId);
  }, [selectedRiskItem, blockedItems]);

  const riskLocalityUnassignedItems = useMemo(() => {
    if (!selectedRiskItem) return [];
    return unassignedItems.filter((item: any) => item.localityId === selectedRiskItem.localityId);
  }, [selectedRiskItem, unassignedItems]);

  const riskLocalityReportPendingItems = useMemo(() => {
    if (!selectedRiskItem) return [];
    return pendingReportItems.filter((item: any) => item.localityId === selectedRiskItem.localityId);
  }, [selectedRiskItem, pendingReportItems]);

  const riskScoreComposition = useMemo(() => {
    if (!selectedRiskItem) return [];
    const breakdown = selectedRiskItem.breakdown ?? {};
    const factors = [
      { key: 'late', label: 'Tarefas atrasadas', count: Number(breakdown.late ?? 0), weight: 2 },
      { key: 'blocked', label: 'Tarefas bloqueadas', count: Number(breakdown.blocked ?? 0), weight: 2 },
      { key: 'unassigned', label: 'Sem responsável', count: Number(breakdown.unassigned ?? 0), weight: 1 },
      { key: 'reportPending', label: 'Relatórios pendentes', count: Number(breakdown.reportPending ?? 0), weight: 2 },
    ];
    return factors.map((factor) => ({ ...factor, points: factor.count * factor.weight }));
  }, [selectedRiskItem]);

  const progressLocalitiesSortedAsc = useMemo(
    () => [...progressByLocality].sort((a: any, b: any) => a.progress - b.progress),
    [progressByLocality],
  );

  const localitiesWithProgress = useMemo(
    () => [...progressByLocality].filter((item: any) => item.progress > 0).sort((a: any, b: any) => b.progress - a.progress),
    [progressByLocality],
  );

  const renderTaskTable = (items: any[]) => (
    <Table size="small">
      <TableHead>
        <TableRow sx={{ bgcolor: 'primary.main' }}>
          <TableCell sx={{ color: 'white', fontWeight: 700 }}>Título</TableCell>
          <TableCell sx={{ color: 'white', fontWeight: 700 }}>Fase</TableCell>
          <TableCell sx={{ color: 'white', fontWeight: 700 }}>Localidade</TableCell>
          <TableCell sx={{ color: 'white', fontWeight: 700 }}>Prazo</TableCell>
          <TableCell sx={{ color: 'white', fontWeight: 700 }}>Status</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((item: any) => (
          <TableRow key={item.taskId} hover>
            <TableCell>{item.title}</TableCell>
            <TableCell>{item.phaseName || '-'}</TableCell>
            <TableCell>{item.localityCode || item.localityName || '-'}</TableCell>
            <TableCell>{formatDate(item.dueDate)}</TableCell>
            <TableCell>{formatStatus(item.status)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  if (!can(me, 'dashboard', 'view')) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Dashboard Executivo
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Acesso restrito.
        </Typography>
      </Box>
    );
  }

  if (dashboardQuery.isLoading) return <SkeletonState />;
  if (dashboardQuery.isError) return <ErrorState error={dashboardQuery.error} onRetry={() => dashboardQuery.refetch()} />;
  if (!data) return <EmptyState title="Sem dados" description="Ajuste os filtros ou tente novamente." />;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4">Dashboard Executivo</Typography>
        <Button variant="outlined" onClick={downloadCsv}>
          Exportar CSV
        </Button>
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              size="small"
              type="date"
              label="De"
              InputLabelProps={{ shrink: true }}
              value={from}
              onChange={(e) => updateParam('from', e.target.value)}
            />
            <TextField
              size="small"
              type="date"
              label="Até"
              InputLabelProps={{ shrink: true }}
              value={to}
              onChange={(e) => updateParam('to', e.target.value)}
            />
            <TextField
              size="small"
              label="Comando"
              value={command}
              onChange={(e) => updateParam('command', e.target.value)}
              sx={{ minWidth: 160 }}
            />
            <TextField
              select
              size="small"
              label="Limiar"
              value={threshold}
              onChange={(e) => updateParam('threshold', e.target.value)}
              sx={{ minWidth: 140 }}
            >
              {['50', '60', '70', '80', '90'].map((value) => (
                <MenuItem key={value} value={value}>
                  {value}%
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </CardContent>
      </Card>

      <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: 'repeat(4, 1fr)' }} gap={2} mb={2}>
        <Card
          sx={{ cursor: 'pointer' }}
          onClick={() => setDetailView({ type: 'progress' })}
        >
          <CardContent>
            <Typography variant="overline">Progresso médio</Typography>
            <Typography variant="h4">{data.progress?.overall ?? 0}%</Typography>
            <Typography variant="caption" color="text.secondary">
              Clique para ver por fase/localidade
            </Typography>
          </CardContent>
        </Card>
        <Card
          sx={{ cursor: 'pointer' }}
          onClick={() => setDetailView({ type: 'late' })}
        >
          <CardContent>
            <Typography variant="overline">Atrasadas</Typography>
            <Typography variant="h4">{data.late?.total ?? 0}</Typography>
            <Typography variant="caption" color="text.secondary">
              Clique para listar tarefas atrasadas
            </Typography>
          </CardContent>
        </Card>
        <Card
          sx={{ cursor: 'pointer' }}
          onClick={() => setDetailView({ type: 'unassigned' })}
        >
          <CardContent>
            <Typography variant="overline">Sem responsável</Typography>
            <Typography variant="h4">{data.unassigned?.total ?? 0}</Typography>
            <Typography variant="caption" color="text.secondary">
              Clique para listar pendências
            </Typography>
          </CardContent>
        </Card>
        <Card
          sx={{ cursor: 'pointer' }}
          onClick={() => setDetailView({ type: 'blocked' })}
        >
          <CardContent>
            <Typography variant="overline">Bloqueadas</Typography>
            <Typography variant="h4">{data.blocked?.total ?? 0}</Typography>
            <Typography variant="caption" color="text.secondary">
              Clique para ver bloqueios
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: 'repeat(2, 1fr)' }} gap={2} mb={2}>
        <Card>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Atraso (tendência 8 semanas)
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Clique em um ponto para abrir os detalhes da semana.
            </Typography>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart
                data={trend}
                onClick={(event: any) => {
                  const payload = event?.activePayload?.[0]?.payload;
                  handleLateTrendClick(payload);
                }}
              >
                <XAxis dataKey="week" hide />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="late"
                  stroke="#0B4DA1"
                  strokeWidth={2}
                  onClick={(payload: any) => handleLateTrendClick(payload)}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Localidades acima do threshold
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Clique em uma barra para ver quais localidades estão acima/abaixo.
            </Typography>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={thresholdByPhase}
                onClick={(event: any) => {
                  const payload = event?.activePayload?.[0]?.payload;
                  handleThresholdClick(payload);
                }}
              >
                <XAxis dataKey="phaseName" />
                <YAxis />
                <Tooltip />
                <Bar
                  dataKey="percentLocalitiesAbove"
                  fill="#0B4DA1"
                  onClick={(payload: any) => handleThresholdClick(payload)}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Box>

      <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: 'repeat(2, 1fr)' }} gap={2}>
        <Card>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Lead time médio (dias)
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Clique em uma barra para detalhes da fase.
            </Typography>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={leadTimeByPhase}
                onClick={(event: any) => {
                  const payload = event?.activePayload?.[0]?.payload;
                  handleLeadTimeClick(payload);
                }}
              >
                <XAxis dataKey="phaseName" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="avgLeadDays" fill="#2E7DFF" onClick={(payload: any) => handleLeadTimeClick(payload)} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardContent sx={{ cursor: 'pointer' }} onClick={() => setDetailView({ type: 'reports' })}>
            <Typography variant="subtitle1" gutterBottom>
              Compliance de relatório
            </Typography>
            <Stack spacing={1}>
              <Typography variant="body2">Aprovados: {data.reportsCompliance?.approved ?? 0}</Typography>
              <Typography variant="body2">Pendentes: {data.reportsCompliance?.pending ?? 0}</Typography>
              <Typography variant="body2">Total: {data.reportsCompliance?.total ?? 0}</Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Clique para detalhar os pendentes.
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            Mapa de risco (Top 10)
          </Typography>
          {riskTop10.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              Sem dados de risco.
            </Typography>
          )}
          {riskTop10.length > 0 && (
            <Box component="table" width="100%" sx={{ borderCollapse: 'collapse' }}>
              <Box component="thead">
                <Box component="tr">
                  {['Localidade', 'Score', 'Atraso', 'Bloqueadas', 'Sem resp.', 'Relatório pend.'].map((header) => (
                    <Box key={header} component="th" sx={{ textAlign: 'left', pb: 1 }}>
                      {header}
                    </Box>
                  ))}
                </Box>
              </Box>
              <Box component="tbody">
                  {riskTop10.map((item: any) => (
                    <Box key={item.localityId} component="tr" sx={{ borderTop: '1px solid #E6ECF5' }}>
                      <Box component="td" sx={{ py: 1 }}>
                        <Stack direction="row" spacing={1}>
                          <Button size="small" href={`/dashboard/locality/${item.localityId}`}>
                            {item.localityCode}
                          </Button>
                          <Button
                            size="small"
                            variant="text"
                            onClick={() => setDetailView({ type: 'risk', localityId: item.localityId })}
                          >
                            Detalhes
                          </Button>
                        </Stack>
                      </Box>
                      <Box component="td" sx={{ py: 1 }}>
                        {item.score}
                      </Box>
                      <Box component="td" sx={{ py: 1 }}>
                        {item.breakdown?.late ?? 0}
                      </Box>
                      <Box component="td" sx={{ py: 1 }}>
                        {item.breakdown?.blocked ?? 0}
                      </Box>
                      <Box component="td" sx={{ py: 1 }}>
                        {item.breakdown?.unassigned ?? 0}
                      </Box>
                      <Box component="td" sx={{ py: 1 }}>
                        {item.breakdown?.reportPending ?? 0}
                      </Box>
                    </Box>
                  ))}
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      <Drawer
        anchor="right"
        open={Boolean(detailView)}
        onClose={() => setDetailView(null)}
        PaperProps={{ sx: { width: { xs: '100%', md: 720 } } }}
      >
        <Box p={3} sx={{ height: '100%', overflowY: 'auto' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Detalhes KPI</Typography>
            <Button onClick={() => setDetailView(null)}>Fechar</Button>
          </Stack>

          {detailView?.type === 'progress' && (
            <Stack spacing={2}>
              <Typography variant="subtitle1">Progresso por fase</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {progressByPhase.map((phase: any) => (
                  <Chip key={phase.phaseId} label={`${phase.phaseName}: ${phase.progress}%`} />
                ))}
              </Stack>
              <Divider />
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip label={`Localidades: ${progressByLocality.length}`} />
                <Chip label={`Com progresso: ${localitiesWithProgress.length}`} color="success" />
                <Chip label={`Sem progresso: ${progressByLocality.length - localitiesWithProgress.length}`} color="warning" />
              </Stack>
              <Typography variant="subtitle1">Top 10 localidades com menor progresso</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'primary.main' }}>
                    <TableCell sx={{ color: 'white', fontWeight: 700 }}>Localidade</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 700 }}>Progresso</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 700 }}>Tarefas</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {progressLocalitiesSortedAsc
                    .slice(0, 10)
                    .map((item: any) => (
                      <TableRow key={item.localityId}>
                        <TableCell>{item.localityCode || item.localityName}</TableCell>
                        <TableCell>{item.progress}%</TableCell>
                        <TableCell>{item.tasksCount ?? 0}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              <Divider />
              <Typography variant="subtitle1">Localidades com progresso ({localitiesWithProgress.length})</Typography>
              {localitiesWithProgress.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nenhuma localidade com progresso para os filtros atuais.
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'primary.main' }}>
                      <TableCell sx={{ color: 'white', fontWeight: 700 }}>Localidade</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 700 }}>Progresso</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 700 }}>Tarefas</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {localitiesWithProgress.map((item: any) => (
                      <TableRow key={`with-progress-${item.localityId}`}>
                        <TableCell>{item.localityCode || item.localityName}</TableCell>
                        <TableCell>{item.progress}%</TableCell>
                        <TableCell>{item.tasksCount ?? 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Stack>
          )}

          {detailView?.type === 'late' && (
            <Stack spacing={2}>
              <Typography variant="subtitle1">Tarefas atrasadas ({lateItems.length})</Typography>
              <Typography variant="body2" color="text.secondary">
                Localidades mais impactadas:
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {lateByLocality.slice(0, 12).map((entry: any) => (
                  <Chip
                    key={entry.localityId || entry.localityCode || entry.localityName}
                    label={`${entry.localityCode || entry.localityName}: ${entry.count}`}
                  />
                ))}
              </Stack>
              <Divider />
              {lateItems.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Não há tarefas atrasadas para os filtros atuais.
                </Typography>
              ) : (
                renderTaskTable(lateItems)
              )}
            </Stack>
          )}

          {detailView?.type === 'unassigned' && (
            <Stack spacing={2}>
              <Typography variant="subtitle1">Tarefas sem responsável ({unassignedItems.length})</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {(data.unassigned?.byCommand ?? []).map((entry: any) => (
                  <Chip key={entry.commandName} label={`${entry.commandName}: ${entry.count}`} />
                ))}
              </Stack>
              <Divider />
              {unassignedItems.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Não há tarefas sem responsável para os filtros atuais.
                </Typography>
              ) : (
                renderTaskTable(unassignedItems)
              )}
            </Stack>
          )}

          {detailView?.type === 'blocked' && (
            <Stack spacing={2}>
              <Typography variant="subtitle1">Tarefas bloqueadas ({blockedItems.length})</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {(data.blocked?.byLocality ?? []).slice(0, 12).map((entry: any) => (
                  <Chip key={entry.localityId} label={`${entry.localityCode || entry.localityName}: ${entry.count}`} />
                ))}
              </Stack>
              <Divider />
              {blockedItems.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Não há tarefas bloqueadas para os filtros atuais.
                </Typography>
              ) : (
                renderTaskTable(blockedItems)
              )}
            </Stack>
          )}

          {detailView?.type === 'lateWeek' && (
            <Stack spacing={2}>
              <Typography variant="subtitle1">
                Semana de {formatDate(detailView.week)}: {weeklyDetails.trendPoint?.late ?? 0} pendências
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {(weeklyDetails.trendPoint?.localities ?? []).map((entry: any) => (
                  <Chip key={entry.localityId} label={`${entry.localityCode || entry.localityName}: ${entry.count}`} />
                ))}
              </Stack>
              <Divider />
              {weeklyDetails.tasks.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Sem tarefas para esta semana.
                </Typography>
              ) : (
                renderTaskTable(weeklyDetails.tasks)
              )}
            </Stack>
          )}

          {detailView?.type === 'threshold' && (
            <Stack spacing={2}>
              <Typography variant="subtitle1">
                {selectedThresholdPhase?.phaseName ?? 'Fase'} — threshold {selectedThresholdPhase?.threshold ?? threshold}%
              </Typography>
              <Stack direction="row" spacing={1}>
                <Chip label={`Acima: ${selectedThresholdPhase?.localitiesAboveCount ?? 0}`} color="success" />
                <Chip label={`Abaixo: ${selectedThresholdPhase?.localitiesBelowCount ?? 0}`} color="warning" />
              </Stack>
              <Divider />
              <Typography variant="subtitle2">Localidades abaixo do threshold</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'primary.main' }}>
                    <TableCell sx={{ color: 'white', fontWeight: 700 }}>Localidade</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 700 }}>Progresso</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(selectedThresholdPhase?.localitiesBelow ?? []).map((item: any) => (
                    <TableRow key={item.localityId}>
                      <TableCell>{item.localityCode || item.localityName}</TableCell>
                      <TableCell>{item.progress}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Stack>
          )}

          {detailView?.type === 'leadTime' && (
            <Stack spacing={2}>
              <Typography variant="subtitle1">
                {selectedLeadPhase?.phaseName ?? 'Fase'} — lead time médio {selectedLeadPhase?.avgLeadDays ?? 0} dias
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Tarefas concluídas: {selectedLeadPhase?.doneCount ?? 0}
              </Typography>
              <Divider />
              <Typography variant="subtitle2">Amostra de tarefas com maior lead time</Typography>
              {(selectedLeadPhase?.sampleTasks ?? []).length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Sem amostra de tarefas concluídas para esta fase.
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'primary.main' }}>
                      <TableCell sx={{ color: 'white', fontWeight: 700 }}>Título</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 700 }}>Localidade</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 700 }}>Lead (dias)</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 700 }}>Prazo</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(selectedLeadPhase?.sampleTasks ?? []).map((item: any) => (
                      <TableRow key={item.taskId}>
                        <TableCell>{item.title}</TableCell>
                        <TableCell>{item.localityCode || item.localityName || '-'}</TableCell>
                        <TableCell>{item.leadDays}</TableCell>
                        <TableCell>{formatDate(item.dueDate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Stack>
          )}

          {detailView?.type === 'reports' && (
            <Stack spacing={2}>
              <Typography variant="subtitle1">Pendências de relatório ({pendingReportItems.length})</Typography>
              <Typography variant="body2" color="text.secondary">
                Aprovados: {data.reportsCompliance?.approved ?? 0} · Pendentes: {data.reportsCompliance?.pending ?? 0}
              </Typography>
              <Divider />
              {pendingReportItems.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Não há relatórios pendentes para os filtros atuais.
                </Typography>
              ) : (
                renderTaskTable(pendingReportItems)
              )}
            </Stack>
          )}

          {detailView?.type === 'risk' && (
            <Stack spacing={2}>
              <Typography variant="subtitle1">
                Mapa de risco - localidade {selectedRiskItem?.localityCode || selectedRiskItem?.localityId}
              </Typography>
              {selectedRiskItem && (
                <Typography variant="body2" color="text.secondary">
                  Posição no ranking: #{selectedRiskRank ?? '-'} de {riskTop10.length} no Top 10, com score {selectedRiskItem.score}.
                </Typography>
              )}
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip label={`Score: ${selectedRiskItem?.score ?? 0}`} color="warning" />
                <Chip label={`Atraso: ${selectedRiskItem?.breakdown?.late ?? 0}`} />
                <Chip label={`Bloqueadas: ${selectedRiskItem?.breakdown?.blocked ?? 0}`} />
                <Chip label={`Sem resp.: ${selectedRiskItem?.breakdown?.unassigned ?? 0}`} />
                <Chip label={`Relatório pend.: ${selectedRiskItem?.breakdown?.reportPending ?? 0}`} />
                {selectedRiskItem?.commandName && <Chip label={`Comando: ${selectedRiskItem.commandName}`} variant="outlined" />}
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Motivo da posição: o score soma o volume de pendências, com peso maior para atrasos, bloqueios e relatórios pendentes.
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'primary.main' }}>
                    <TableCell sx={{ color: 'white', fontWeight: 700 }}>Fator</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 700 }}>Qtd</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 700 }}>Peso</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 700 }}>Pontos</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {riskScoreComposition.map((factor: any) => (
                    <TableRow key={factor.key}>
                      <TableCell>{factor.label}</TableCell>
                      <TableCell>{factor.count}</TableCell>
                      <TableCell>x{factor.weight}</TableCell>
                      <TableCell>{factor.points}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Divider />
              <Typography variant="subtitle2">Evidências por fator na localidade</Typography>
              <Typography variant="body2" color="text.secondary">
                Abaixo estão as tarefas que explicam a pontuação desta localidade no mapa de risco.
              </Typography>
              <Typography variant="subtitle2">Atrasadas ({riskLocalityLateItems.length})</Typography>
              {riskLocalityLateItems.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nenhuma tarefa atrasada para os filtros atuais.
                </Typography>
              ) : (
                renderTaskTable(riskLocalityLateItems)
              )}
              <Typography variant="subtitle2">Bloqueadas ({riskLocalityBlockedItems.length})</Typography>
              {riskLocalityBlockedItems.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nenhuma tarefa bloqueada para os filtros atuais.
                </Typography>
              ) : (
                renderTaskTable(riskLocalityBlockedItems)
              )}
              <Typography variant="subtitle2">Sem responsável ({riskLocalityUnassignedItems.length})</Typography>
              {riskLocalityUnassignedItems.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nenhuma tarefa sem responsável para os filtros atuais.
                </Typography>
              ) : (
                renderTaskTable(riskLocalityUnassignedItems)
              )}
              <Typography variant="subtitle2">Relatórios pendentes ({riskLocalityReportPendingItems.length})</Typography>
              {riskLocalityReportPendingItems.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nenhuma pendência de relatório para os filtros atuais.
                </Typography>
              ) : (
                renderTaskTable(riskLocalityReportPendingItems)
              )}
              <Button
                variant="outlined"
                href={selectedRiskItem ? `/dashboard/locality/${selectedRiskItem.localityId}` : '#'}
                disabled={!selectedRiskItem}
              >
                Abrir dashboard da localidade
              </Button>
            </Stack>
          )}
        </Box>
      </Drawer>
    </Box>
  );
}
