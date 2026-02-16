import { Box, Card, CardContent, Chip, Grid, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import TargetIcon from '@mui/icons-material/GpsFixed';
import PeopleIcon from '@mui/icons-material/Groups';
import DescriptionIcon from '@mui/icons-material/Description';
import StarIcon from '@mui/icons-material/Star';
import { Link } from 'react-router-dom';
import { useDashboardNational, useMe, useTasks, useTaskTemplates } from '../api/hooks';
import { SkeletonState } from '../components/states/SkeletonState';
import { ErrorState } from '../components/states/ErrorState';
import { EmptyState } from '../components/states/EmptyState';
import { DueBadge } from '../components/chips/DueBadge';
import { StatusChip } from '../components/chips/StatusChip';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export function DashboardNationalPage() {
  const { data: me } = useMe();
  const dashboardQuery = useDashboardNational({});
  const tasksQuery = useTasks({});
  const templatesQuery = useTaskTemplates();
  const qc = useQueryClient();

  if (dashboardQuery.isLoading) return <SkeletonState />;
  if (dashboardQuery.isError) return <ErrorState error={dashboardQuery.error} onRetry={() => dashboardQuery.refetch()} />;

  const items = dashboardQuery.data?.items ?? [];
  const totals = dashboardQuery.data?.totals ?? { late: 0, blocked: 0, unassigned: 0, recruitsFemale: 0, reportsProduced: 0 };
  const templateMap = new Map((templatesQuery.data?.items ?? []).map((t: any) => [t.id, t]));
  const tasks = (tasksQuery.data?.items ?? []).map((task: any) => ({
    ...task,
    taskTemplate: templateMap.get(task.taskTemplateId),
  }));

  const riskTasks = tasks
    .filter((task: any) => task.isLate || task.status === 'BLOCKED' || task.hasAssignee === false)
    .slice(0, 5);

  const averageProgress = items.length
    ? Math.round(items.reduce((acc: number, item: any) => acc + item.progress, 0) / items.length)
    : 0;

  const kpiCards = [
    { label: 'Cobertura', value: `${items.length}/${items.length} localidades`, icon: <TargetIcon sx={{ fontSize: 28 }} />, bg: '#E8F8EF' },
    { label: 'Alcance', value: `${totals.recruitsFemale ?? 0} pessoas`, icon: <PeopleIcon sx={{ fontSize: 28 }} />, bg: '#E8F2FF' },
    { label: 'Relatórios', value: `${totals.reportsProduced ?? 0} produzidos`, icon: <DescriptionIcon sx={{ fontSize: 28 }} />, bg: '#FFF6E1' },
    { label: 'Satisfação', value: '—', icon: <StarIcon sx={{ fontSize: 28 }} />, bg: '#E8F8EF' },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight={700}>
        Indicadores de Desempenho
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Metas e acompanhamento — visão Brasil
      </Typography>
      <Grid container spacing={2}>
        {kpiCards.map((kpi) => (
          <Grid key={kpi.label} item xs={12} sm={6} md={3}>
            <Card sx={{ background: kpi.bg, border: '1px solid rgba(0,0,0,0.06)' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ color: 'primary.main' }}>{kpi.icon}</Box>
                <Box>
                  <Typography variant="overline" color="text.secondary" fontWeight={600}>{kpi.label}</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>{kpi.value}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Chip size="small" label={`Tarefas atrasadas: ${totals.late}`} color={totals.late > 0 ? 'error' : 'default'} />
        <Chip size="small" label={`Sem responsável: ${totals.unassigned}`} color={totals.unassigned > 0 ? 'warning' : 'default'} />
        <Chip size="small" label={`Bloqueadas: ${totals.blocked}`} color={totals.blocked > 0 ? 'warning' : 'default'} />
      </Box>

      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Localidades
              </Typography>
              {items.length === 0 ? (
                <EmptyState title="Sem dados" description="Nenhuma localidade encontrada." />
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'primary.main' }}>
                      <TableCell sx={{ color: 'white', fontWeight: 600 }}>Localidade / GSD</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600 }}>% Geral</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600 }}>Recrutas</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600 }}>Comandante</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600 }}>Visita</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600 }}>Atrasadas</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600 }}>Sem resp.</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600 }}>Bloqueadas</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600 }}>Abrir</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((loc: any) => (
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
                        <TableCell>{loc.blocked}</TableCell>
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
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
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
                  {riskTasks.map((task: any) => (
                    <Card key={task.id} variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2">{task.taskTemplate?.title ?? 'Tarefa'}</Typography>
                        <Box display="flex" gap={1} flexWrap="wrap" mt={1}>
                          <StatusChip status={task.status} isLate={task.isLate} />
                          <DueBadge dueDate={task.dueDate} />
                          {(task.comments?.unread ?? 0) > 0 && (
                            <Chip size="small" color="warning" label={`Novo comentário (${task.comments.unread})`} />
                          )}
                          {!me?.executive_hide_pii && task.assigneeLabel && (
                            <Chip size="small" label={`Responsável: ${task.assigneeLabel}`} />
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
