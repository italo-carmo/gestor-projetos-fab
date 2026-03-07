import {
  Box,
  Button,
  Card,
  CardContent,
  Drawer,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useExecutiveDashboard, useMe } from '../api/hooks';
import { can } from '../app/rbac';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { SkeletonState } from '../components/states/SkeletonState';

const KPI_BLUE_CARD_SX = {
  bgcolor: 'rgb(83, 127, 151)',
  backgroundColor: 'rgb(83, 127, 151) !important',
  border: '1px solid rgba(139, 184, 207, 0.38)',
  boxShadow: '0 18px 34px rgba(15,44,59,0.36)',
} as const;
const BLUE_TEXT_MAIN = { color: '#F4FAFD' };
const BLUE_TEXT_SUB = { color: 'rgba(231,244,250,0.92)' };

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR');
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
  const [selectedReport, setSelectedReport] = useState<any | null>(null);

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
  const completedReportItems = data.reportsCompliance?.completedItems ?? [];
  const visitedCities = Number(
    data.summary?.visitedCities ??
      byLocality.filter((item: any) => Number(item.done ?? 0) > 0).length,
  );
  const participantsInActivities = Number(
    data.summary?.participantsInActivities ??
      completedReportItems.reduce(
        (acc: number, item: any) => acc + Number(item?.report?.participantsCount ?? 0),
        0,
      ),
  );

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
        gridTemplateColumns={{ xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' }}
        gap={2}
      >
        <Card sx={{ ...KPI_BLUE_CARD_SX, minHeight: 320 }}>
          <CardContent sx={{ backgroundColor: 'rgb(83, 127, 151) !important', height: '100%' }}>
            <Typography variant="subtitle1" sx={{ ...BLUE_TEXT_MAIN, fontWeight: 700, mb: 1.4 }}>
              Indicadores executivos
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                gap: 1.2,
              }}
            >
              {[
                {
                  label: 'Atividades concluídas',
                  value: doneCount,
                  helper: `Taxa de conclusão: ${closureRate}%`,
                },
                {
                  label: 'Cidades visitadas',
                  value: visitedCities,
                  helper: 'Localidades com atividade concluída',
                },
                {
                  label: 'Relatórios aprovados',
                  value: approvedReports,
                  helper: `Conformidade: ${reportsComplianceRate}%`,
                },
                {
                  label: 'Participantes em atividades',
                  value: participantsInActivities,
                  helper: 'Somatório dos relatórios concluídos',
                },
              ].map((item) => (
                <Box
                  key={item.label}
                  sx={{
                    p: 1.4,
                    borderRadius: 2,
                    border: '1px solid rgba(255,255,255,0.45)',
                    bgcolor: 'rgba(255,255,255,0.12)',
                  }}
                >
                  <Typography variant="overline" sx={BLUE_TEXT_SUB}>
                    {item.label}
                  </Typography>
                  <Typography variant="h4" sx={{ ...BLUE_TEXT_MAIN, lineHeight: 1.05 }}>
                    {item.value}
                  </Typography>
                  <Typography variant="caption" sx={BLUE_TEXT_SUB}>
                    {item.helper}
                  </Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ minHeight: 320 }}>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 700 }}>
              Indicadores por especialidade
            </Typography>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={topSpecialties}
                layout="vertical"
                margin={{ left: 20, right: 10 }}
              >
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="specialtyName" width={150} />
                <Tooltip formatter={(value: any) => [value, 'Atividades']} />
                <Bar dataKey="count" fill="#4D86A0" radius={[0, 6, 6, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card sx={{ minHeight: 320 }}>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 700 }}>
              Destaque de performance por localidade
            </Typography>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topLocalitiesByProgress}>
                <XAxis dataKey="localityCode" />
                <YAxis />
                <Tooltip formatter={(value: any) => [`${value}%`, 'Progresso']} />
                <Bar dataKey="progress" fill="#114259" radius={[6, 6, 0, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card sx={{ minHeight: 320 }}>
          <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 700 }}>
              Relatórios concluídos
            </Typography>
            {completedReportItems.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nenhum relatório concluído no período selecionado.
              </Typography>
            ) : (
              <Box sx={{ display: 'grid', gap: 1, overflowY: 'auto', maxHeight: 250, pr: 0.3 }}>
                {completedReportItems.map((item: any) => (
                  <Card key={item.activityId} variant="outlined" sx={{ borderColor: 'rgba(17,66,89,0.18)' }}>
                    <CardContent sx={{ p: 1.2 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                            {item.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {(item.localityCode || item.localityName) ?? '-'} - Assinado em {formatDateTime(item.report?.signedAt)}
                          </Typography>
                        </Box>
                        <Button size="small" variant="outlined" onClick={() => setSelectedReport(item)}>
                          Ler
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>

      <Drawer
        anchor="right"
        open={Boolean(selectedReport)}
        onClose={() => setSelectedReport(null)}
        PaperProps={{ sx: { width: { xs: '100%', md: 560 } } }}
      >
        <Box sx={{ p: 3, pt: 7 }}>
          <Typography variant="h6" sx={{ mt: 2, mb: 0.8 }}>
            {selectedReport?.title || 'Relatório'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.8 }}>
            {selectedReport?.localityName || '-'} - {formatDateTime(selectedReport?.report?.signedAt)}
          </Typography>

          <Stack spacing={1.4}>
            <Box>
              <Typography variant="subtitle2">Responsável</Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedReport?.report?.responsible || '-'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2">Objetivos da missão</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                {selectedReport?.report?.missionObjectives || '-'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2">Atividades realizadas</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                {selectedReport?.report?.activitiesPerformed || '-'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2">Perfil dos participantes</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                {selectedReport?.report?.participantsCharacteristics || '-'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2">Conclusão</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                {selectedReport?.report?.conclusion || '-'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2">Resumo numérico</Typography>
              <Typography variant="body2" color="text.secondary">
                Participantes: {selectedReport?.report?.participantsCount ?? 0} | Instrutores:{' '}
                {selectedReport?.report?.instructorsCount ?? 0} | Recrutas:{' '}
                {selectedReport?.report?.recruitsCount ?? 0}
              </Typography>
            </Box>
          </Stack>
        </Box>
      </Drawer>
    </Box>
  );
}
