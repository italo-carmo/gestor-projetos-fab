import { Box, Card, CardContent, Chip, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useActivities,
  useCalendarYear,
  useDashboardNational,
  useMe,
  useMissions,
  useTaskInstance,
  useTasks,
  useTaskTemplates,
} from '../api/hooks';
import { SkeletonState } from '../components/states/SkeletonState';
import { ErrorState } from '../components/states/ErrorState';
import { EmptyState } from '../components/states/EmptyState';
import { CalendarView, type CalendarEventInput } from '../components/calendar/CalendarView';
import { TaskDetailsDrawer } from '../components/tasks/TaskDetailsDrawer';
import { TASK_STATUS_LABELS } from '../constants/enums';
import { selectTargetLocalities } from '../constants/localities';

const YEAR_START = (y: number) => `${y}-01-01`;
const YEAR_END = (y: number) => `${y}-12-31`;

function formatDateRange(startIso: string, endIso: string): string {
  try {
    const start = parseISO(startIso);
    const end = parseISO(endIso);
    return `${format(start, 'dd/MM/yyyy', { locale: ptBR })} a ${format(end, 'dd/MM/yyyy', { locale: ptBR })}`;
  } catch {
    return `${startIso} a ${endIso}`;
  }
}

export function CalendarPage() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const localityId = params.get('localityId') ?? '';

  const calendarQuery = useCalendarYear(year, { localityId: localityId || undefined });
  const dashboardQuery = useDashboardNational({ localityId: localityId || undefined });
  const tasksQuery = useTasks({
    dueFrom: YEAR_START(year),
    dueTo: YEAR_END(year),
    localityId: localityId || undefined,
  });
  const templatesQuery = useTaskTemplates();
  const missionsQuery = useMissions(
    { localityId: localityId || undefined, pageSize: '500' },
    true,
  );
  const activitiesSmifQuery = useActivities({
    localityId: localityId || undefined,
    pageSize: '500',
    scope: 'SMIF',
  });
  const activitiesCipavdQuery = useActivities({
    localityId: localityId || undefined,
    pageSize: '500',
    scope: 'CIPAVD',
  });

  const localities = selectTargetLocalities(
    (dashboardQuery.data?.items ?? []).map((loc: any) => ({
      id: loc.localityId,
      name: loc.localityName,
    })),
  ).filter(
    (loc: any) =>
      String(loc.id ?? '').trim() &&
      String(loc.name ?? '').trim(),
  );
  const localityMap = new Map(localities.map((l: any) => [l.id, l.name]));

  const templateMap = new Map((templatesQuery.data?.items ?? []).map((t: any) => [t.id, t]));
  const tasks = (tasksQuery.data?.items ?? []).map((task: any) => ({
    ...task,
    taskTemplate: templateMap.get(task.taskTemplateId),
  }));
  const taskById = new Map(tasks.map((task: any) => [task.id, task]));

  const events = useMemo((): CalendarEventInput[] => {
    const yearStart = YEAR_START(year);
    const yearEnd = YEAR_END(year);

    const taskEvents: CalendarEventInput[] = (calendarQuery.data?.items ?? []).map((item: any) => {
      const task: any = taskById.get(item.taskInstanceId);
      const localityName = task?.localityId ? localityMap.get(task.localityId) : null;
      return {
        id: item.taskInstanceId,
        title: item.title,
        date: item.date,
        status: task?.status,
        kind: 'task',
        subtitle: localityName
          ? `${localityName} • ${TASK_STATUS_LABELS[task?.status ?? ''] ?? task?.status ?? ''}`
          : TASK_STATUS_LABELS[task?.status ?? ''] ?? task?.status ?? '',
      };
    });

    const missionItems = (missionsQuery.data?.items ?? []) as Array<{
      id: string;
      title?: string;
      startDate: string;
      endDate: string;
      locality?: { name?: string };
      localityId?: string;
    }>;
    const missionEvents: CalendarEventInput[] = missionItems
      .filter((m) => m.startDate && m.endDate && m.startDate <= yearEnd && m.endDate >= yearStart)
      .map((m) => ({
        id: `mission:${m.id}`,
        title: m.title ?? 'Missão',
        date: m.startDate,
        endDate: m.endDate,
        kind: 'mission' as const,
        subtitle: [
          m.locality?.name ?? localityMap.get(m.localityId ?? ''),
          formatDateRange(m.startDate, m.endDate),
        ]
          .filter(Boolean)
          .join(' • '),
      }));

    const allActivities = [
      ...((activitiesSmifQuery.data?.items ?? []) as any[]),
      ...((activitiesCipavdQuery.data?.items ?? []) as any[]),
    ];
    const activityEvents: CalendarEventInput[] = allActivities
      .filter((a) => {
        const d = a.eventDate;
        if (!d) return false;
        const dateStr = typeof d === 'string' ? d.slice(0, 10) : (d as Date).toISOString?.().slice(0, 10) ?? '';
        return dateStr >= yearStart && dateStr <= yearEnd;
      })
      .map((a) => {
        const d = a.eventDate;
        const dateStr = typeof d === 'string' ? d.slice(0, 10) : (d as Date).toISOString?.().slice(0, 10) ?? '';
        const locName = a.locality?.name ?? localityMap.get(a.localityId ?? '');
        const typeName = a.activityType?.name ?? '';
        return {
          id: `activity:${a.id}`,
          title: a.title ?? 'Atividade de campo',
          date: dateStr,
          kind: 'activity' as const,
          subtitle: [locName, typeName].filter(Boolean).join(' • '),
        };
      });

    return [...taskEvents, ...missionEvents, ...activityEvents];
  }, [
    year,
    calendarQuery.data?.items,
    taskById,
    localityMap,
    missionsQuery.data?.items,
    activitiesSmifQuery.data?.items,
    activitiesCipavdQuery.data?.items,
  ]);

  /** Referência estável para não resetar a navegação do calendário a cada render do pai. */
  const calendarSeedDate = useMemo(() => {
    const now = new Date();
    return year === now.getFullYear()
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
      : new Date(year, 0, 1);
  }, [year]);

  const selectedTaskFromList = tasks.find((item: any) => item.id === selectedTaskId) ?? null;
  const selectedTaskQuery = useTaskInstance(
    selectedTaskId ?? '',
    Boolean(selectedTaskId) && !selectedTaskFromList && !selectedTaskId.startsWith('mission:') && !selectedTaskId.startsWith('activity:'),
  );
  const selectedTask = selectedTaskFromList ?? selectedTaskQuery.data ?? null;

  const handleSelectEvent = (id: string) => {
    if (id.startsWith('mission:')) {
      const missionId = id.slice('mission:'.length);
      navigate(`/missions?missionId=${encodeURIComponent(missionId)}`);
      return;
    }
    if (id.startsWith('activity:')) {
      const activityId = id.slice('activity:'.length);
      navigate(`/activities?activityId=${encodeURIComponent(activityId)}`);
      return;
    }
    setSelectedTaskId(id);
  };

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  if (calendarQuery.isLoading) return <SkeletonState />;
  if (calendarQuery.isError) return <ErrorState error={calendarQuery.error} onRetry={() => calendarQuery.refetch()} />;

  return (
    <Box sx={{ pb: 0.2 }}>
      <Typography variant="h4" gutterBottom fontWeight={700} sx={{ mb: 0.5 }}>
        Calendário
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Tarefas, missões e atividades de campo no mesmo calendário. Clique em um evento para abrir detalhes ou ir à tela correspondente.
      </Typography>
      <Card sx={{ mb: 1 }}>
        <CardContent sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.2, alignItems: 'center', py: 1.4 }}>
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
          <EmptyState
            title="Sem eventos"
            description="Nenhuma tarefa, missão ou atividade de campo no ano selecionado. Ajuste os filtros ou o ano."
          />
        </Card>
      ) : (
        <Card sx={{ overflow: 'hidden' }}>
          <Box sx={{ px: { xs: 0.7, md: 0.9 }, pt: 0.7 }}>
            <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center" sx={{ mb: 0.5 }}>
              <Chip size="small" label="Tarefas" sx={{ bgcolor: '#E3F2FD', borderColor: '#1565C0', border: '1px solid' }} />
              <Chip size="small" label="Missões" sx={{ bgcolor: '#EDE7F6', borderColor: '#5E35B1', border: '1px solid' }} />
              <Chip size="small" label="Atividades de campo" sx={{ bgcolor: '#E0F2F1', borderColor: '#00695C', border: '1px solid' }} />
            </Stack>
          </Box>
          <Box
            sx={{
              p: { xs: 0.7, md: 0.9 },
              height: { xs: 'calc(100vh - 352px)', md: 'calc(100vh - 316px)' },
              minHeight: 510,
              maxHeight: 576,
            }}
          >
            <CalendarView
              key={year}
              events={events}
              onSelect={handleSelectEvent}
              height="100%"
              date={calendarSeedDate}
            />
          </Box>
        </Card>
      )}

      <TaskDetailsDrawer
        task={selectedTask}
        open={Boolean(selectedTaskId)}
        onClose={() => setSelectedTaskId(null)}
        onDeleted={() => setSelectedTaskId(null)}
        user={me}
        localities={localities}
        loading={Boolean(selectedTaskId) && !selectedTaskFromList && selectedTaskQuery.isLoading}
      />
    </Box>
  );
}
