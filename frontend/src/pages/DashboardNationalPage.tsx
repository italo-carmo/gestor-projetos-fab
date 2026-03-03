import { Box, Button, Card, CardContent, Chip, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import TargetIcon from '@mui/icons-material/GpsFixed';
import PeopleIcon from '@mui/icons-material/Groups';
import DescriptionIcon from '@mui/icons-material/Description';
import NewspaperRoundedIcon from '@mui/icons-material/NewspaperRounded';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDashboardNational } from '../api/hooks';
import { SkeletonState } from '../components/states/SkeletonState';
import { ErrorState } from '../components/states/ErrorState';
import { EmptyState } from '../components/states/EmptyState';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
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
  const navigate = useNavigate();
  const localityId = params.get('localityId') ?? '';
  const dashboardQuery = useDashboardNational({ localityId: localityId || undefined });
  const qc = useQueryClient();

  if (dashboardQuery.isLoading) return <SkeletonState />;
  if (dashboardQuery.isError) return <ErrorState error={dashboardQuery.error} onRetry={() => dashboardQuery.refetch()} />;

  const items = (dashboardQuery.data?.items ?? []) as NationalLocalityItem[];
  const smifLocalities = [...items]
    .sort((a, b) => a.localityName.localeCompare(b.localityName, 'pt-BR'))
    .slice(0, 8);
  const totals = dashboardQuery.data?.totals ?? {
    late: 0,
    unassigned: 0,
    recruitsFemale: 0,
    reportsProduced: 0,
    smifNewsCount: 0,
  };
  const positiveHighlights = ((dashboardQuery.data?.riskTasks ?? []) as NationalActivityItem[])
    .sort((a, b) => {
      const dateA = a.eventDate ? new Date(a.eventDate).getTime() : 0;
      const dateB = b.eventDate ? new Date(b.eventDate).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, 5);
  const averageProgress = smifLocalities.length
    ? Math.round(smifLocalities.reduce((acc, item) => acc + Number(item.progress ?? 0), 0) / smifLocalities.length)
    : 0;

  const kpiCards = [
    { label: 'Cobertura', value: `${smifLocalities.length}/${smifLocalities.length} localidades`, icon: <TargetIcon sx={{ fontSize: 28 }} />, bg: '#E8F8EF' },
    {
      label: 'Recrutas femininas',
      value: String(totals.recruitsFemale ?? 0),
      icon: <PeopleIcon sx={{ fontSize: 28 }} />,
      bg: '#E8F2FF',
    },
    {
      label: 'Execução média',
      value: `${averageProgress}%`,
      icon: <TargetIcon sx={{ fontSize: 28 }} />,
      bg: '#EEF8FF',
    },
    {
      label: 'Reportagens (SMIF)',
      value: String(totals.smifNewsCount ?? 0),
      icon: <NewspaperRoundedIcon sx={{ fontSize: 28 }} />,
      bg: '#F2F5FF',
    },
    { label: 'Relatórios', value: `${totals.reportsProduced ?? 0} produzidos`, icon: <DescriptionIcon sx={{ fontSize: 28 }} />, bg: '#FFF6E1' },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight={700}>
        Painel de Comando - SMIF
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Acompanhamento estratégico do alistamento feminino, execução de atividades e prontidão nas OM.
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
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {smifLocalities.map((loc) => (
                        <TableRow
                          key={loc.localityId}
                          hover
                          onClick={() => navigate(`/dashboard/locality/${loc.localityId}`)}
                          onMouseEnter={() =>
                            qc.prefetchQuery({
                              queryKey: ['localityProgress', loc.localityId],
                              queryFn: async () =>
                                (await api.get(`/localities/${loc.localityId}/progress`)).data,
                            })
                          }
                          sx={{ cursor: 'pointer' }}
                        >
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
                Destaques recentes
              </Typography>
              {positiveHighlights.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nenhum destaque encontrado.
                </Typography>
              ) : (
                <Box display="grid" gap={1}>
                  {positiveHighlights.map((activity) => (
                    <Card key={activity.activityId} variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2">{activity.title ?? 'Atividade'}</Typography>
                        <Box display="flex" gap={1} flexWrap="wrap" mt={1}>
                          <Chip size="small" color="success" label="Em execução" />
                          {activity.eventDate && (
                            <Chip
                              size="small"
                              variant="outlined"
                              label={new Date(activity.eventDate).toLocaleDateString('pt-BR')}
                            />
                          )}
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
