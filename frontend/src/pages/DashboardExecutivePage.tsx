import {
  Box,
  Button,
  Card,
  CardContent,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useExecutiveDashboard, useMe } from '../api/hooks';
import { SkeletonState } from '../components/states/SkeletonState';
import { ErrorState } from '../components/states/ErrorState';
import { EmptyState } from '../components/states/EmptyState';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar } from 'recharts';
import { can } from '../app/rbac';

export function DashboardExecutivePage() {
  const { data: me } = useMe();
  const [params, setParams] = useSearchParams();
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

  const riskTop10 = data.risk?.top10 ?? [];

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

      <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: 'repeat(3, 1fr)' }} gap={2} mb={2}>
        <Card>
          <CardContent>
            <Typography variant="overline">Progresso médio</Typography>
            <Typography variant="h4">{data.progress?.overall ?? 0}%</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="overline">Atrasadas</Typography>
            <Typography variant="h4">{data.late?.total ?? 0}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="overline">Sem responsável</Typography>
            <Typography variant="h4">{data.unassigned?.total ?? 0}</Typography>
          </CardContent>
        </Card>
      </Box>

      <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: 'repeat(2, 1fr)' }} gap={2} mb={2}>
        <Card>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Atraso (tendência 8 semanas)
            </Typography>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data.late?.trend ?? []}>
                <XAxis dataKey="week" hide />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="late" stroke="#0B4DA1" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Localidades acima do threshold
            </Typography>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.localityAboveThreshold ?? []}>
                <XAxis dataKey="phaseName" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="percentLocalitiesAbove" fill="#0B4DA1" />
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
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.leadTime ?? []}>
                <XAxis dataKey="phaseName" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="avgLeadDays" fill="#2E7DFF" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Compliance de relatório
            </Typography>
            <Stack spacing={1}>
              <Typography variant="body2">Aprovados: {data.reportsCompliance?.approved ?? 0}</Typography>
              <Typography variant="body2">Pendentes: {data.reportsCompliance?.pending ?? 0}</Typography>
              <Typography variant="body2">Total: {data.reportsCompliance?.total ?? 0}</Typography>
            </Stack>
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
                      <Button size="small" href={`/dashboard/locality/${item.localityId}`}>
                        {item.localityCode}
                      </Button>
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
    </Box>
  );
}
