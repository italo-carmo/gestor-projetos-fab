import { Box, Card, CardContent, TextField, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCalendarYear, useMe, useTasks, useTaskTemplates } from '../api/hooks';
import { SkeletonState } from '../components/states/SkeletonState';
import { ErrorState } from '../components/states/ErrorState';
import { EmptyState } from '../components/states/EmptyState';
import { YearCalendarView } from '../components/calendar/YearCalendarView';
import { TaskDetailsDrawer } from '../components/tasks/TaskDetailsDrawer';

export function CalendarPage() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [params] = useSearchParams();
  const { data: me } = useMe();
  const localityId = params.get('localityId') ?? '';

  const calendarQuery = useCalendarYear(year, { localityId: localityId || undefined });
  const tasksQuery = useTasks({
    dueFrom: `${year}-01-01`,
    dueTo: `${year}-12-31`,
    localityId: localityId || undefined,
  });
  const templatesQuery = useTaskTemplates();

  const events = useMemo(() => {
    const items = calendarQuery.data?.items ?? [];
    return items.map((item: any) => ({
      id: item.taskInstanceId,
      title: item.title,
      date: item.date,
    }));
  }, [calendarQuery.data]);

  const templateMap = new Map((templatesQuery.data?.items ?? []).map((t: any) => [t.id, t]));
  const tasks = (tasksQuery.data?.items ?? []).map((task: any) => ({
    ...task,
    taskTemplate: templateMap.get(task.taskTemplateId),
  }));
  const selectedTask = tasks.find((item: any) => item.id === selectedTaskId) ?? null;

  if (calendarQuery.isLoading) return <SkeletonState />;
  if (calendarQuery.isError) return <ErrorState error={calendarQuery.error} onRetry={() => calendarQuery.refetch()} />;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Calendario
      </Typography>
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            size="small"
            type="number"
            label="Ano"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            inputProps={{ min: 2020, max: 2035 }}
          />
        </CardContent>
      </Card>

      {events.length === 0 ? (
        <EmptyState title="Sem eventos" description="Nao ha tarefas para este ano." />
      ) : (
        <YearCalendarView year={year} events={events} onSelect={(id) => setSelectedTaskId(id)} />
      )}

      <TaskDetailsDrawer
        task={selectedTask}
        open={Boolean(selectedTaskId)}
        onClose={() => setSelectedTaskId(null)}
        user={me}
      />
    </Box>
  );
}
