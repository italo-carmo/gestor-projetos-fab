import { Box, Button, Card, CardContent, Chip, Divider, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { useDashboardNational, useLocalityProgress, useTasks, useMe, useTaskTemplates } from '../api/hooks';
import { SkeletonState } from '../components/states/SkeletonState';
import { ErrorState } from '../components/states/ErrorState';
import { EmptyState } from '../components/states/EmptyState';
import { ProgressInline } from '../components/chips/ProgressInline';
import { DueBadge } from '../components/chips/DueBadge';

export function DashboardLocalityPage() {
  const { id } = useParams();
  const { data: me } = useMe();
  const dashboardQuery = useDashboardNational({});
  const progressQuery = useLocalityProgress(id ?? '');
  const tasksQuery = useTasks({ localityId: id });
  const templatesQuery = useTaskTemplates();

  if (progressQuery.isLoading) return <SkeletonState />;
  if (progressQuery.isError) return <ErrorState error={progressQuery.error} onRetry={() => progressQuery.refetch()} />;

  const progress = progressQuery.data;
  const templateMap = new Map((templatesQuery.data?.items ?? []).map((t: any) => [t.id, t]));
  const tasks = (tasksQuery.data?.items ?? []).map((task: any) => ({
    ...task,
    taskTemplate: templateMap.get(task.taskTemplateId),
  }));

  const upcoming = [...tasks]
    .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);
  const late = tasks.filter((task: any) => task.isLate).slice(0, 5);
  const unassigned = tasks.filter((task: any) => !task.assignedToId).slice(0, 5);

  const localityInfo = (dashboardQuery.data?.items ?? []).find((loc: any) => loc.localityId === id);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        {localityInfo?.localityName ?? `Localidade ${id}`}
      </Typography>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary">
            Progresso geral
          </Typography>
          <ProgressInline value={progress?.overallProgress ?? 0} />
          <Divider sx={{ my: 2 }} />
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <Button component={Link} to={`/gantt?localityId=${id}`} variant="outlined" size="small">
              Ver Gantt
            </Button>
            <Button component={Link} to={`/calendar?localityId=${id}`} variant="outlined" size="small">
              Ver Calendario
            </Button>
          </Stack>
          <Stack spacing={1}>
            {progress?.byPhase?.map((phase: any) => (
              <Box key={phase.phaseName} display="flex" alignItems="center" gap={2}>
                <Typography variant="caption" sx={{ minWidth: 120 }}>
                  {phase.phaseName}
                </Typography>
                <ProgressInline value={phase.progress ?? 0} />
              </Box>
            ))}
          </Stack>
        </CardContent>
      </Card>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Proximas tarefas
            </Typography>
            {upcoming.length === 0 ? (
              <EmptyState title="Sem tarefas" description="Nenhuma tarefa cadastrada." />
            ) : (
              <Stack spacing={1}>
                {upcoming.map((task: any) => (
                  <Box key={task.id} display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">{task.taskTemplate?.title ?? 'Tarefa'}</Typography>
                    <DueBadge dueDate={task.dueDate} />
                  </Box>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Atrasadas
            </Typography>
            {late.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nenhuma tarefa atrasada.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {late.map((task: any) => (
                  <Box key={task.id} display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">{task.taskTemplate?.title ?? 'Tarefa'}</Typography>
                    <Chip size="small" label="Atrasada" color="warning" />
                  </Box>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Sem responsavel
            </Typography>
            {unassigned.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nenhuma tarefa sem responsavel.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {unassigned.map((task: any) => (
                  <Box key={task.id} display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">{task.taskTemplate?.title ?? 'Tarefa'}</Typography>
                    {!me?.executive_hide_pii && <Chip size="small" label="Sem resp." />}
                  </Box>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
