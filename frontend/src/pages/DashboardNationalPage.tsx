import { Box, Card, CardContent, Chip, Grid, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { useDashboardNational, useMe, useTasks, useTaskTemplates } from '../api/hooks';
import { SkeletonState } from '../components/states/SkeletonState';
import { ErrorState } from '../components/states/ErrorState';
import { EmptyState } from '../components/states/EmptyState';
import { DueBadge } from '../components/chips/DueBadge';
import { StatusChip } from '../components/chips/StatusChip';

export function DashboardNationalPage() {
  const { data: me } = useMe();
  const dashboardQuery = useDashboardNational({});
  const tasksQuery = useTasks({});
  const templatesQuery = useTaskTemplates();

  if (dashboardQuery.isLoading) return <SkeletonState />;
  if (dashboardQuery.isError) return <ErrorState error={dashboardQuery.error} onRetry={() => dashboardQuery.refetch()} />;

  const items = dashboardQuery.data?.items ?? [];
  const totals = dashboardQuery.data?.totals ?? { late: 0, blocked: 0, unassigned: 0 };
  const templateMap = new Map((templatesQuery.data?.items ?? []).map((t: any) => [t.id, t]));
  const tasks = (tasksQuery.data?.items ?? []).map((task: any) => ({
    ...task,
    taskTemplate: templateMap.get(task.taskTemplateId),
  }));

  const riskTasks = tasks
    .filter((task: any) => task.isLate || task.status === 'BLOCKED' || !task.assignedToId)
    .slice(0, 5);

  const averageProgress = items.length
    ? Math.round(items.reduce((acc: number, item: any) => acc + item.progress, 0) / items.length)
    : 0;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Visao Brasil
      </Typography>
      <Grid container spacing={2}>
        {[
          { label: 'Progresso medio', value: `${averageProgress}%` },
          { label: 'Tarefas atrasadas', value: totals.late },
          { label: 'Sem responsavel', value: totals.unassigned },
          { label: 'Bloqueadas', value: totals.blocked },
          { label: 'Turnover', value: 'N/A' },
        ].map((kpi) => (
          <Grid key={kpi.label} item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="overline">{kpi.label}</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {kpi.value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

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
                    <TableRow>
                      <TableCell>Localidade</TableCell>
                      <TableCell>% Geral</TableCell>
                      <TableCell>Atrasadas</TableCell>
                      <TableCell>Sem resp.</TableCell>
                      <TableCell>Bloqueadas</TableCell>
                      <TableCell>Abrir</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((loc: any) => (
                      <TableRow key={loc.localityId}>
                        <TableCell>{loc.localityName}</TableCell>
                        <TableCell>{Math.round(loc.progress)}%</TableCell>
                        <TableCell>{loc.late}</TableCell>
                        <TableCell>{loc.unassigned}</TableCell>
                        <TableCell>{loc.blocked}</TableCell>
                        <TableCell>
                          <Link to={`/dashboard/locality/${loc.localityId}`}>Abrir</Link>
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
                          {!me?.executive_hide_pii && task.assignedToId && (
                            <Chip size="small" label={`Resp: ${task.assignedToId}`} />
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
