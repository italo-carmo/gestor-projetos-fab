import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Drawer,
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
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useExecutiveDashboard, useMe } from '../api/hooks';
import { can } from '../app/rbac';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { SkeletonState } from '../components/states/SkeletonState';
import { ACTIVITY_STATUS_LABELS } from '../constants/enums';

type DetailView =
  | { type: 'late' }
  | { type: 'unassigned' }
  | { type: 'reports' }
  | { type: 'risk'; localityId: string };

function formatDate(value: string | Date | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('pt-BR');
}

function formatStatus(value: string | null | undefined) {
  if (!value) return '-';
  return ACTIVITY_STATUS_LABELS[value] ?? value;
}

export function DashboardExecutivePage() {
  const { data: me } = useMe();
  const [params, setParams] = useSearchParams();
  const [detailView, setDetailView] = useState<DetailView | null>(null);

  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const threshold = params.get('threshold') ?? '70';
  const command = params.get('command') ?? '';
  const localityId = params.get('localityId') ?? '';

  const filters = useMemo(
    () => ({
      from: from || undefined,
      to: to || undefined,
      threshold: threshold || undefined,
      command: command || undefined,
      localityId: localityId || undefined,
    }),
    [from, to, threshold, command, localityId],
  );

  const dashboardQuery = useExecutiveDashboard(filters);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

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

  const data = dashboardQuery.data;
  if (!data) return <EmptyState title="Sem dados" description="Ajuste os filtros ou tente novamente." />;

  const statusItems = data.status?.items ?? [];
  const lateItems = data.late?.items ?? [];
  const unassignedItems = data.unassigned?.items ?? [];
  const pendingReportItems = data.reportsCompliance?.pendingItems ?? [];
  const trend = data.late?.trend ?? [];
  const riskTop10 = data.risk?.top10 ?? [];
  const byLocality = data.progress?.byLocality ?? [];
  const bySpecialty = data.specialties?.items ?? [];

  const localityOptions = [...byLocality].sort((a: any, b: any) =>
    String(a.localityName ?? '').localeCompare(String(b.localityName ?? ''), 'pt-BR'),
  );

  const downloadCsv = () => {
    const headers = ['localityCode', 'score', 'late', 'unassigned', 'reportPending'];
    const rows = riskTop10.map((item: any) => [
      item.localityCode,
      item.score,
      item.breakdown?.late ?? 0,
      item.breakdown?.unassigned ?? 0,
      item.breakdown?.reportPending ?? 0,
    ]);
    const csv = [headers.join(','), ...rows.map((row: any[]) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'executive-activities-dashboard.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedRiskItem =
    detailView?.type === 'risk'
      ? riskTop10.find((entry: any) => entry.localityId === detailView.localityId) ?? null
      : null;

  const riskLateItems = selectedRiskItem
    ? lateItems.filter((item: any) => item.localityId === selectedRiskItem.localityId)
    : [];
  const riskUnassignedItems = selectedRiskItem
    ? unassignedItems.filter((item: any) => item.localityId === selectedRiskItem.localityId)
    : [];
  const riskPendingReports = selectedRiskItem
    ? pendingReportItems.filter((item: any) => item.localityId === selectedRiskItem.localityId)
    : [];

  const renderActivityTable = (items: any[]) => (
    <Table size="small">
      <TableHead>
        <TableRow sx={{ bgcolor: 'primary.main' }}>
          <TableCell sx={{ color: 'white', fontWeight: 700 }}>Atividade</TableCell>
          <TableCell sx={{ color: 'white', fontWeight: 700 }}>Localidade</TableCell>
          <TableCell sx={{ color: 'white', fontWeight: 700 }}>Especialidade</TableCell>
          <TableCell sx={{ color: 'white', fontWeight: 700 }}>Data</TableCell>
          <TableCell sx={{ color: 'white', fontWeight: 700 }}>Status</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((item: any) => (
          <TableRow key={item.activityId} hover>
            <TableCell>{item.title}</TableCell>
            <TableCell>{item.localityCode || item.localityName || '-'}</TableCell>
            <TableCell>{item.specialtyName || '-'}</TableCell>
            <TableCell>{formatDate(item.eventDate || item.createdAt)}</TableCell>
            <TableCell>{formatStatus(item.status)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

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
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap" useFlexGap>
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
              sx={{ minWidth: 190 }}
            />
            <TextField
              select
              size="small"
              label="Localidade"
              value={localityId}
              onChange={(e) => updateParam('localityId', e.target.value)}
              sx={{ minWidth: 220 }}
            >
              <MenuItem value="">Todas</MenuItem>
              {localityOptions.map((locality: any) => (
                <MenuItem key={locality.localityId} value={locality.localityId}>
                  {locality.localityCode || locality.localityName}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Limiar"
              value={threshold}
              onChange={(e) => updateParam('threshold', e.target.value)}
              sx={{ minWidth: 130 }}
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
        <Card>
          <CardContent>
            <Typography variant="overline">Progresso médio</Typography>
            <Typography variant="h4">{data.progress?.overall ?? 0}%</Typography>
            <Typography variant="caption" color="text.secondary">
              Baseado no status das atividades
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ cursor: 'pointer' }} onClick={() => setDetailView({ type: 'late' })}>
          <CardContent>
            <Typography variant="overline">Atividades atrasadas</Typography>
            <Typography variant="h4">{data.late?.total ?? 0}</Typography>
            <Typography variant="caption" color="text.secondary">
              Clique para detalhes
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ cursor: 'pointer' }} onClick={() => setDetailView({ type: 'unassigned' })}>
          <CardContent>
            <Typography variant="overline">Sem responsável</Typography>
            <Typography variant="h4">{data.unassigned?.total ?? 0}</Typography>
            <Typography variant="caption" color="text.secondary">
              Clique para detalhes
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ cursor: 'pointer' }} onClick={() => setDetailView({ type: 'reports' })}>
          <CardContent>
            <Typography variant="overline">Relatórios pendentes</Typography>
            <Typography variant="h4">{data.reportsCompliance?.pending ?? 0}</Typography>
            <Typography variant="caption" color="text.secondary">
              Clique para detalhes
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: 'repeat(2, 1fr)' }} gap={2} mb={2}>
        <Card>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Status das atividades
            </Typography>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={statusItems}>
                <XAxis dataKey="status" tickFormatter={(value) => formatStatus(value)} />
                <YAxis allowDecimals={false} />
                <Tooltip formatter={(value: any) => [value, 'Quantidade']} labelFormatter={(value: any) => formatStatus(value)} />
                <Bar dataKey="count" fill="#0B4DA1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Tendência de atraso (8 semanas)
            </Typography>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trend}>
                <XAxis dataKey="week" hide />
                <YAxis allowDecimals={false} />
                <Tooltip labelFormatter={(value) => formatDate(String(value))} formatter={(value: any) => [value, 'Atrasadas']} />
                <Line type="monotone" dataKey="late" stroke="#2E7DFF" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Box>

      <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: 'repeat(2, 1fr)' }} gap={2} mb={2}>
        <Card>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Progresso por localidade
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
              <Chip label={`Acima do limiar: ${data.localityAboveThreshold?.count ?? 0}`} color="success" />
              <Chip label={`Total: ${data.localityAboveThreshold?.total ?? 0}`} variant="outlined" />
            </Stack>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={[...byLocality].sort((a: any, b: any) => b.progress - a.progress).slice(0, 12)}>
                <XAxis dataKey="localityCode" />
                <YAxis />
                <Tooltip formatter={(value: any) => [`${value}%`, 'Progresso']} />
                <Bar dataKey="progress" fill="#114259" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Atividades por especialidade
            </Typography>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={bySpecialty.slice(0, 12)} layout="vertical" margin={{ left: 30 }}>
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="specialtyName" width={140} />
                <Tooltip formatter={(value: any) => [value, 'Atividades']} />
                <Bar dataKey="count" fill="#4D86A0" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Box>

      <Card>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            Top riscos (atividades)
          </Typography>
          {riskTop10.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Sem dados de risco para os filtros atuais.
            </Typography>
          ) : (
            <Box component="table" width="100%" sx={{ borderCollapse: 'collapse' }}>
              <Box component="thead">
                <Box component="tr">
                  {['Localidade', 'Score', 'Atrasadas', 'Sem resp.', 'Relatório pend.', 'Ação'].map((header) => (
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
                      {item.localityCode || item.localityId}
                    </Box>
                    <Box component="td" sx={{ py: 1 }}>
                      {item.score}
                    </Box>
                    <Box component="td" sx={{ py: 1 }}>
                      {item.breakdown?.late ?? 0}
                    </Box>
                    <Box component="td" sx={{ py: 1 }}>
                      {item.breakdown?.unassigned ?? 0}
                    </Box>
                    <Box component="td" sx={{ py: 1 }}>
                      {item.breakdown?.reportPending ?? 0}
                    </Box>
                    <Box component="td" sx={{ py: 1 }}>
                      <Button size="small" onClick={() => setDetailView({ type: 'risk', localityId: item.localityId })}>
                        Detalhes
                      </Button>
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
        PaperProps={{ sx: { width: { xs: '100%', md: 760 } } }}
      >
        <Box p={3} sx={{ height: '100%', overflowY: 'auto' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Detalhes</Typography>
            <Button onClick={() => setDetailView(null)}>Fechar</Button>
          </Stack>

          {detailView?.type === 'late' && (
            <Stack spacing={2}>
              <Typography variant="subtitle1">Atividades atrasadas ({lateItems.length})</Typography>
              {lateItems.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Sem atividades atrasadas para os filtros atuais.
                </Typography>
              ) : (
                renderActivityTable(lateItems)
              )}
            </Stack>
          )}

          {detailView?.type === 'unassigned' && (
            <Stack spacing={2}>
              <Typography variant="subtitle1">Atividades sem responsável ({unassignedItems.length})</Typography>
              {unassignedItems.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Sem pendências de responsável para os filtros atuais.
                </Typography>
              ) : (
                renderActivityTable(unassignedItems)
              )}
            </Stack>
          )}

          {detailView?.type === 'reports' && (
            <Stack spacing={2}>
              <Typography variant="subtitle1">Relatórios pendentes ({pendingReportItems.length})</Typography>
              <Typography variant="body2" color="text.secondary">
                Aprovados: {data.reportsCompliance?.approved ?? 0} · Pendentes: {data.reportsCompliance?.pending ?? 0}
              </Typography>
              {pendingReportItems.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Sem relatórios pendentes para os filtros atuais.
                </Typography>
              ) : (
                renderActivityTable(pendingReportItems)
              )}
            </Stack>
          )}

          {detailView?.type === 'risk' && (
            <Stack spacing={2}>
              <Typography variant="subtitle1">
                Risco da localidade {selectedRiskItem?.localityCode || selectedRiskItem?.localityId || '-'}
              </Typography>
              {selectedRiskItem ? (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip label={`Score ${selectedRiskItem.score}`} color="warning" />
                  <Chip label={`Atrasadas: ${selectedRiskItem.breakdown?.late ?? 0}`} />
                  <Chip label={`Sem responsável: ${selectedRiskItem.breakdown?.unassigned ?? 0}`} />
                  <Chip label={`Relatório pendente: ${selectedRiskItem.breakdown?.reportPending ?? 0}`} />
                </Stack>
              ) : null}

              <Typography variant="subtitle2">Atividades atrasadas</Typography>
              {riskLateItems.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nenhuma atividade atrasada nessa localidade.
                </Typography>
              ) : (
                renderActivityTable(riskLateItems)
              )}

              <Typography variant="subtitle2">Atividades sem responsável</Typography>
              {riskUnassignedItems.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nenhuma atividade sem responsável nessa localidade.
                </Typography>
              ) : (
                renderActivityTable(riskUnassignedItems)
              )}

              <Typography variant="subtitle2">Relatórios pendentes</Typography>
              {riskPendingReports.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nenhuma pendência de relatório nessa localidade.
                </Typography>
              ) : (
                renderActivityTable(riskPendingReports)
              )}
            </Stack>
          )}
        </Box>
      </Drawer>
    </Box>
  );
}
