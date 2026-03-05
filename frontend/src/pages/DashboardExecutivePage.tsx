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
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useExecutiveDashboard, useMe } from '../api/hooks';
import { can } from '../app/rbac';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { SkeletonState } from '../components/states/SkeletonState';
import { ACTIVITY_STATUS_LABELS } from '../constants/enums';

const KPI_BLUE_CARD_SX = {
  bgcolor: '#1F4A61',
  border: '1px solid rgba(139, 184, 207, 0.38)',
} as const;
const BLUE_TEXT_MAIN = { color: '#F4FAFD' };
const BLUE_TEXT_SUB = { color: 'rgba(231,244,250,0.92)' };

function formatStatus(value: string | null | undefined) {
  if (!value) return '-';
  return ACTIVITY_STATUS_LABELS[value] ?? value;
}

export function DashboardExecutivePage() {
  const { data: me } = useMe();
  const [params, setParams] = useSearchParams();

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
          Painel de Comando - CIPAVD
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Acesso restrito.
        </Typography>
      </Box>
    );
  }

  if (dashboardQuery.isLoading) return <SkeletonState />;
  if (dashboardQuery.isError)
    return (
      <ErrorState
        error={dashboardQuery.error}
        onRetry={() => dashboardQuery.refetch()}
      />
    );

  const data = dashboardQuery.data;
  if (!data)
    return (
      <EmptyState
        title="Sem dados"
        description="Ajuste os filtros ou tente novamente."
      />
    );

  const statusItems = data.status?.items ?? [];
  const byLocality = data.progress?.byLocality ?? [];
  const bySpecialty = data.specialties?.items ?? [];

  const doneCount =
    statusItems.find((item: any) => String(item.status) === 'DONE')?.count ?? 0;
  const totalActivities = statusItems.reduce(
    (acc: number, item: any) => acc + Number(item.count ?? 0),
    0,
  );
  const closureRate = totalActivities
    ? Math.round((doneCount / totalActivities) * 100)
    : 0;

  const approvedReports = Number(data.reportsCompliance?.approved ?? 0);
  const pendingReports = Number(data.reportsCompliance?.pending ?? 0);
  const totalReports = approvedReports + pendingReports;
  const reportsComplianceRate = totalReports
    ? Math.round((approvedReports / totalReports) * 100)
    : 100;

  const localityOptions = [...byLocality].sort((a: any, b: any) =>
    String(a.localityName ?? '').localeCompare(
      String(b.localityName ?? ''),
      'pt-BR',
    ),
  );

  const topSpecialties = [...bySpecialty]
    .sort((a: any, b: any) => Number(b.count ?? 0) - Number(a.count ?? 0))
    .slice(0, 12);

  const topLocalitiesByProgress = [...byLocality]
    .sort((a: any, b: any) => Number(b.progress ?? 0) - Number(a.progress ?? 0))
    .slice(0, 12);

  const downloadCsv = () => {
    const headers = ['localityCode', 'localityName', 'progress', 'specialtyName', 'specialtyCount'];
    const rows = topLocalitiesByProgress.map((item: any, index: number) => {
      const specialty = topSpecialties[index];
      return [
        item.localityCode ?? '',
        item.localityName ?? '',
        item.progress ?? 0,
        specialty?.specialtyName ?? '',
        specialty?.count ?? 0,
      ];
    });
    const csv = [headers.join(','), ...rows.map((row: any[]) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'painel-cipavd-indicadores-positivos.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h4">Painel de Comando - CIPAVD</Typography>
          <Typography variant="body2" color="text.secondary">
            Visão de entregas, produtividade e performance da comissão nas OM.
          </Typography>
        </Box>
        <Button variant="outlined" onClick={downloadCsv}>
          Exportar CSV
        </Button>
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            flexWrap="wrap"
            useFlexGap
          >
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

      <Box
        display="grid"
        gridTemplateColumns={{ xs: '1fr', md: 'repeat(3, 1fr)' }}
        gap={2}
        mb={2}
      >
        <Card sx={KPI_BLUE_CARD_SX}>
          <CardContent>
            <Typography variant="overline" sx={BLUE_TEXT_SUB}>Atividades concluídas</Typography>
            <Typography variant="h4" sx={BLUE_TEXT_MAIN}>{doneCount}</Typography>
            <Typography variant="caption" sx={BLUE_TEXT_SUB}>
              Entregas finalizadas no período
            </Typography>
          </CardContent>
        </Card>
        <Card sx={KPI_BLUE_CARD_SX}>
          <CardContent>
            <Typography variant="overline" sx={BLUE_TEXT_SUB}>Taxa de conclusão</Typography>
            <Typography variant="h4" sx={BLUE_TEXT_MAIN}>{closureRate}%</Typography>
            <Typography variant="caption" sx={BLUE_TEXT_SUB}>
              Concluídas sobre total de atividades
            </Typography>
          </CardContent>
        </Card>
        <Card sx={KPI_BLUE_CARD_SX}>
          <CardContent>
            <Typography variant="overline" sx={BLUE_TEXT_SUB}>Relatórios aprovados</Typography>
            <Typography variant="h4" sx={BLUE_TEXT_MAIN}>{approvedReports}</Typography>
            <Typography variant="caption" sx={BLUE_TEXT_SUB}>
              Conformidade de relatórios: {reportsComplianceRate}%
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Box
        display="grid"
        gridTemplateColumns={{ xs: '1fr', md: 'repeat(2, 1fr)' }}
        gap={2}
        mb={2}
      >
        <Card>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Distribuição de atividades por status
            </Typography>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={statusItems}>
                <XAxis dataKey="status" tickFormatter={(value) => formatStatus(value)} />
                <YAxis allowDecimals={false} />
                <Tooltip
                  formatter={(value: any) => [value, 'Quantidade']}
                  labelFormatter={(value: any) => formatStatus(value)}
                />
                <Bar dataKey="count" fill="#0B4DA1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Indicadores por especialidade
            </Typography>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={topSpecialties}
                layout="vertical"
                margin={{ left: 30 }}
              >
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="specialtyName" width={150} />
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
            Destaque de performance por localidade
          </Typography>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={topLocalitiesByProgress}>
              <XAxis dataKey="localityCode" />
              <YAxis />
              <Tooltip formatter={(value: any) => [`${value}%`, 'Progresso']} />
              <Bar dataKey="progress" fill="#114259" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </Box>
  );
}
