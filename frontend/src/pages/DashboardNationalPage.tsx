import { Box, Button, Card, CardContent, Chip, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import TargetIcon from '@mui/icons-material/GpsFixed';
import PeopleIcon from '@mui/icons-material/Groups';
import DescriptionIcon from '@mui/icons-material/Description';
import PolicyRoundedIcon from '@mui/icons-material/PolicyRounded';
import { Link, useSearchParams } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useCpcaCaseStats, useDashboardNational } from '../api/hooks';
import { SkeletonState } from '../components/states/SkeletonState';
import { ErrorState } from '../components/states/ErrorState';
import { EmptyState } from '../components/states/EmptyState';
import { DueBadge } from '../components/chips/DueBadge';
import { StatusChip } from '../components/chips/StatusChip';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

type NationalDetailView = 'late' | 'unassigned';
type NationalLocalityItem = {
  localityId: string;
  localityName: string;
  commandName?: string | null;
  progress: number;
  recruitsFemaleCountCurrent?: number | null;
  commanderName?: string | null;
  visitDate?: string | null;
  late: number;
  unassigned: number;
};
type NationalActivityItem = {
  activityId: string;
  title: string;
  localityCode?: string | null;
  localityName?: string | null;
  eventDate?: string | Date | null;
  status: string;
  isLate?: boolean;
};

export function DashboardNationalPage() {
  const [params] = useSearchParams();
  const localityId = params.get('localityId') ?? '';
  const [detailView, setDetailView] = useState<NationalDetailView | null>(null);
  const cpcaFrom = useMemo(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 6);
    return date.toISOString().slice(0, 10);
  }, []);
  const dashboardQuery = useDashboardNational({ localityId: localityId || undefined });
  const cpcaStatsQuery = useCpcaCaseStats({
    localityId: localityId || undefined,
    from: cpcaFrom,
  });
  const cpcaTotalQuery = useCpcaCaseStats({
    localityId: localityId || undefined,
  });
  const qc = useQueryClient();

  if (dashboardQuery.isLoading) return <SkeletonState />;
  if (dashboardQuery.isError) return <ErrorState error={dashboardQuery.error} onRetry={() => dashboardQuery.refetch()} />;

  const items = (dashboardQuery.data?.items ?? []) as NationalLocalityItem[];
  const smifLocalities = [...items]
    .sort((a, b) => a.localityName.localeCompare(b.localityName, 'pt-BR'))
    .slice(0, 8);
  const totals = dashboardQuery.data?.totals ?? { late: 0, unassigned: 0, recruitsFemale: 0, reportsProduced: 0 };
  const lateItems = (dashboardQuery.data?.lateItems ?? []) as NationalActivityItem[];
  const unassignedItems = (dashboardQuery.data?.unassignedItems ?? []) as NationalActivityItem[];
  const riskTasks = ((dashboardQuery.data?.riskTasks ?? []) as NationalActivityItem[]).slice(0, 5);
  const cpcaSummary = cpcaStatsQuery.data?.summary ?? {};
  const cpcaTotalSummary = cpcaTotalQuery.data?.summary ?? {};
  const detailItems = detailView === 'late' ? lateItems : detailView === 'unassigned' ? unassignedItems : [];
  const detailTitle =
    detailView === 'late'
      ? 'Detalhes de atividades atrasadas'
      : 'Detalhes de atividades sem responsável';
  const cpcaStatsLink = localityId
    ? `/cpca-stats?localityId=${encodeURIComponent(localityId)}&from=${encodeURIComponent(cpcaFrom)}`
    : `/cpca-stats?from=${encodeURIComponent(cpcaFrom)}`;

  const kpiCards = [
    { label: 'Cobertura', value: `${smifLocalities.length}/${smifLocalities.length} localidades`, icon: <TargetIcon sx={{ fontSize: 28 }} />, bg: '#E8F8EF' },
    {
      label: 'Recrutas femininas',
      value: String(totals.recruitsFemale ?? 0),
      icon: <PeopleIcon sx={{ fontSize: 28 }} />,
      bg: '#E8F2FF',
    },
    { label: 'Relatórios', value: `${totals.reportsProduced ?? 0} produzidos`, icon: <DescriptionIcon sx={{ fontSize: 28 }} />, bg: '#FFF6E1' },
    {
      label: 'Denúncias',
      value: String(cpcaTotalSummary.totalCases ?? cpcaSummary.totalCases ?? 0),
      icon: <PolicyRoundedIcon sx={{ fontSize: 28 }} />,
      bg: '#FFECEF',
    },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight={700}>
        Visão Nacional
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Painel consolidado de acompanhamento nacional.
      </Typography>
      <Grid container spacing={2} alignItems="stretch">
        {kpiCards.map((kpi) => (
          <Grid key={kpi.label} size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex' }}>
            <Card
              sx={{
                background: kpi.bg,
                border: '1px solid rgba(0,0,0,0.06)',
                width: '100%',
                height: '100%',
                minHeight: 116,
                display: 'flex',
              }}
            >
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                <Box sx={{ color: 'primary.main' }}>{kpi.icon}</Box>
                <Box>
                  <Typography variant="overline" color="text.secondary" fontWeight={600}>{kpi.label}</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{kpi.value}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Chip
          size="small"
          clickable
          variant={detailView === 'late' ? 'filled' : 'outlined'}
          onClick={() => setDetailView('late')}
          label={`Atividades atrasadas: ${totals.late}`}
          color={totals.late > 0 ? 'error' : 'default'}
        />
        <Chip
          size="small"
          clickable
          variant={detailView === 'unassigned' ? 'filled' : 'outlined'}
          onClick={() => setDetailView('unassigned')}
          label={`Sem responsável: ${totals.unassigned}`}
          color={totals.unassigned > 0 ? 'warning' : 'default'}
        />
      </Box>
      <Card sx={{ mt: 2, border: '1px solid rgba(173,47,69,0.2)' }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5} gap={2} flexWrap="wrap">
            <Box>
              <Typography variant="h6">Risco CPCA (assédio)</Typography>
              <Typography variant="body2" color="text.secondary">
                Janela de 6 meses para antecipação de decisão no comando.
              </Typography>
            </Box>
            <Button component={Link} to={cpcaStatsLink} size="small" variant="outlined">
              Ver estatísticas CPCA
            </Button>
          </Box>
          {cpcaStatsQuery.isError ? (
            <Typography variant="body2" color="text.secondary">
              Não foi possível carregar os indicadores CPCA agora.
            </Typography>
          ) : (
            <Grid container spacing={1.2}>
              <Grid size={{ xs: 6, md: 3 }}>
                <Card variant="outlined">
                  <CardContent sx={{ py: 1.4 }}>
                    <Typography variant="caption" color="text.secondary">
                      Notificações
                    </Typography>
                    <Typography variant="h6" fontWeight={800}>
                      {cpcaSummary.totalCases ?? 0}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Card variant="outlined">
                  <CardContent sx={{ py: 1.4 }}>
                    <Typography variant="caption" color="text.secondary">
                      Retaliação em risco
                    </Typography>
                    <Typography variant="h6" fontWeight={800} color={(cpcaSummary.retaliationRiskCases ?? 0) > 0 ? 'error.main' : 'text.primary'}>
                      {cpcaSummary.retaliationRiskCases ?? 0}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Card variant="outlined">
                  <CardContent sx={{ py: 1.4 }}>
                    <Typography variant="caption" color="text.secondary">
                      Triagem &gt; 7 dias
                    </Typography>
                    <Typography variant="h6" fontWeight={800} color={(cpcaSummary.triageOver7Days ?? 0) > 0 ? 'warning.main' : 'text.primary'}>
                      {cpcaSummary.triageOver7Days ?? 0}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Card variant="outlined">
                  <CardContent sx={{ py: 1.4 }}>
                    <Typography variant="caption" color="text.secondary">
                      Apuração &gt; 30 dias
                    </Typography>
                    <Typography variant="h6" fontWeight={800} color={(cpcaSummary.investigationOver30Days ?? 0) > 0 ? 'warning.main' : 'text.primary'}>
                      {cpcaSummary.investigationOver30Days ?? 0}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </CardContent>
      </Card>
      {detailView && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
              <Typography variant="h6">{detailTitle}</Typography>
              <Button size="small" onClick={() => setDetailView(null)}>
                Fechar
              </Button>
            </Box>
            {detailItems.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Não há atividades para este indicador.
              </Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'primary.main' }}>
                    <TableCell sx={{ color: 'white', fontWeight: 600 }}>Título</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 600 }}>Localidade</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 600 }}>Prazo</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 600 }}>Abrir</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {detailItems.map((activity) => (
                    <TableRow key={activity.activityId} hover>
                      <TableCell>{activity.title}</TableCell>
                      <TableCell>{activity.localityCode || activity.localityName || '—'}</TableCell>
                      <TableCell>
                        <DueBadge dueDate={activity.eventDate} status={activity.status} />
                      </TableCell>
                      <TableCell>
                        <StatusChip status={activity.status} isLate={activity.isLate} />
                      </TableCell>
                      <TableCell>
                        <Link to={`/activities?activityId=${activity.activityId}`}>Abrir atividade</Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Localidades
              </Typography>
              {smifLocalities.length === 0 ? (
                <EmptyState title="Sem dados" description="Nenhuma localidade encontrada." />
              ) : (
                <TableContainer sx={{ width: '100%', overflowX: 'auto' }}>
                  <Table size="small" sx={{ minWidth: 980 }}>
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'primary.main' }}>
                        <TableCell sx={{ color: 'white', fontWeight: 600 }}>Localidade / GSD</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 600 }}>% Geral</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 600 }}>Recrutas femininas</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 600 }}>Comandante</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 600 }}>Visita</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 600 }}>Atrasadas</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 600 }}>Sem resp.</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 600 }}>Abrir</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {smifLocalities.map((loc) => (
                        <TableRow key={loc.localityId} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>{loc.localityName}</Typography>
                            {loc.commandName && (
                              <Typography variant="caption" color="text.secondary">{loc.commandName}</Typography>
                            )}
                          </TableCell>
                          <TableCell>{Math.round(loc.progress)}%</TableCell>
                          <TableCell>{loc.recruitsFemaleCountCurrent ?? 0}</TableCell>
                          <TableCell>{loc.commanderName ?? '—'}</TableCell>
                          <TableCell>{loc.visitDate ? new Date(loc.visitDate).toLocaleDateString('pt-BR') : '—'}</TableCell>
                          <TableCell>{loc.late}</TableCell>
                          <TableCell>{loc.unassigned}</TableCell>
                          <TableCell>
                            <Link
                              to={`/dashboard/locality/${loc.localityId}`}
                              onMouseEnter={() =>
                                qc.prefetchQuery({
                                  queryKey: ['localityProgress', loc.localityId],
                                  queryFn: async () =>
                                    (await api.get(`/localities/${loc.localityId}/progress`)).data,
                                })
                              }
                            >
                              Abrir
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Top riscos
              </Typography>
              {riskTasks.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nenhum risco encontrado.
                </Typography>
              ) : (
                <Box display="grid" gap={1}>
                  {riskTasks.map((activity) => (
                    <Card key={activity.activityId} variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2">{activity.title ?? 'Atividade'}</Typography>
                        <Box display="flex" gap={1} flexWrap="wrap" mt={1}>
                          <StatusChip status={activity.status} isLate={activity.isLate} />
                          <DueBadge dueDate={activity.eventDate} />
                          {activity.localityCode && (
                            <Chip
                              size="small"
                              label={activity.localityCode}
                              variant="outlined"
                            />
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
