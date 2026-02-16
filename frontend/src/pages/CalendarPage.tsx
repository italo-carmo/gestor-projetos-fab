import { Box, Card, CardContent, MenuItem, TextField, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCalendarYear, useDashboardNational, useMe, useTaskInstance, useTasks, useTaskTemplates } from '../api/hooks';
import { SkeletonState } from '../components/states/SkeletonState';
import { ErrorState } from '../components/states/ErrorState';
import { EmptyState } from '../components/states/EmptyState';
import { CalendarView } from '../components/calendar/CalendarView';
import { TaskDetailsDrawer } from '../components/tasks/TaskDetailsDrawer';
import { TASK_STATUS_LABELS } from '../constants/enums';

export function CalendarPage() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const { data: me } = useMe();
  const localityId = params.get('localityId') ?? '';

  const calendarQuery = useCalendarYear(year, { localityId: localityId || undefined });
  const dashboardQuery = useDashboardNational({});
  const tasksQuery = useTasks({
    dueFrom: `${year}-01-01`,
    dueTo: `${year}-12-31`,
    localityId: localityId || undefined,
  });
  const templatesQuery = useTaskTemplates();

  const localities = (dashboardQuery.data?.items ?? []).map((loc: any) => ({
    id: loc.localityId,
    name: loc.localityName,
  }));
  const localityMap = new Map(localities.map((l: any) => [l.id, l.name]));

  const templateMap = new Map((templatesQuery.data?.items ?? []).map((t: any) => [t.id, t]));
  const tasks = (tasksQuery.data?.items ?? []).map((task: any) => ({
    ...task,
    taskTemplate: templateMap.get(task.taskTemplateId),
  }));
  const taskById = new Map(tasks.map((task: any) => [task.id, task]));

  const events = useMemo(() => {
    const items = calendarQuery.data?.items ?? [];
    return items.map((item: any) => {
      const task: any = taskById.get(item.taskInstanceId);
      const localityName = task?.localityId ? localityMap.get(task.localityId) : null;
      return {
        id: item.taskInstanceId,
        title: item.title,
        date: item.date,
        status: task?.status,
        subtitle: localityName
          ? `${localityName} • ${TASK_STATUS_LABELS[task?.status ?? ''] ?? task?.status ?? ''}`
          : TASK_STATUS_LABELS[task?.status ?? ''] ?? task?.status ?? '',
      };
    });
  }, [calendarQuery.data, taskById, localityMap]);

  const selectedTaskFromList = tasks.find((item: any) => item.id === selectedTaskId) ?? null;
  const selectedTaskQuery = useTaskInstance(
    selectedTaskId ?? '',
    Boolean(selectedTaskId) && !selectedTaskFromList,
  );
  const selectedTask = selectedTaskFromList ?? selectedTaskQuery.data ?? null;

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  if (calendarQuery.isLoading) return <SkeletonState />;
  if (calendarQuery.isError) return <ErrorState error={calendarQuery.error} onRetry={() => calendarQuery.refetch()} />;

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight={700}>
        Calendário
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Visualize tarefas por mês, semana ou dia. Clique em um evento para ver detalhes.
      </Typography>
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <TextField
            size="small"
            type="number"
            label="Ano"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            inputProps={{ min: 2020, max: 2035 }}
            sx={{ width: 120 }}
          />
          {localities.length > 0 && (
            <TextField
              select
              size="small"
              label="Localidade"
              value={localityId}
              onChange={(e) => updateParam('localityId', e.target.value)}
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="">Todas</MenuItem>
              {localities.map((loc: { id: string; name: string }) => (
                <MenuItem key={loc.id} value={loc.id}>
                  {loc.name}
                </MenuItem>
              ))}
            </TextField>
          )}
        </CardContent>
      </Card>

      {events.length === 0 ? (
        <Card>
          <EmptyState title="Sem eventos" description="Nenhuma tarefa para o ano selecionado. Ajuste os filtros ou o ano." />
        </Card>
      ) : (
        <Card sx={{ overflow: 'hidden' }}>
          <Box sx={{ p: 2 }}>
            <CalendarView
              events={events}
              onSelect={(id) => setSelectedTaskId(id)}
              height={640}
              date={year === new Date().getFullYear() ? new Date() : new Date(year, 0, 1)}
            />
          </Box>
        </Card>
      )}

      <TaskDetailsDrawer
        task={selectedTask}
        open={Boolean(selectedTaskId)}
        onClose={() => setSelectedTaskId(null)}
        user={me}
        localities={localities}
        loading={Boolean(selectedTaskId) && !selectedTaskFromList && selectedTaskQuery.isLoading}
      />
    </Box>
  );
}
