import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Drawer,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import AddTaskRoundedIcon from '@mui/icons-material/AddTaskRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useActivities,
  useCalendarYear,
  useCipavdLocalities,
  useCreateMeeting,
  useCreateTaskInstance,
  useDashboardNational,
  useLocalities,
  useMe,
  useMeetings,
  useMissions,
  usePhases,
  useTaskInstance,
  useTasks,
  useTaskTemplates,
} from '../api/hooks';
import { SkeletonState } from '../components/states/SkeletonState';
import { ErrorState } from '../components/states/ErrorState';
import {
  CalendarView,
  type CalendarEventInput,
} from '../components/calendar/CalendarView';
import { TaskDetailsDrawer } from '../components/tasks/TaskDetailsDrawer';
import {
  MeetingType,
  MEETING_TYPE_LABELS,
  MEETING_STATUS_LABELS,
  TaskPriority,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from '../constants/enums';
import { selectTargetLocalities } from '../constants/localities';
import { can } from '../app/rbac';
import { useToast } from '../app/toast';
import { parseApiError } from '../app/apiErrors';

const YEAR_START = (y: number) => `${y}-01-01`;
const YEAR_END = (y: number) => `${y}-12-31`;
const YEAR_START_DATETIME = (y: number) =>
  new Date(y, 0, 1, 0, 0, 0, 0).toISOString();
const YEAR_END_DATETIME = (y: number) =>
  new Date(y, 11, 31, 23, 59, 59, 999).toISOString();

type LocalityOption = {
  id: string;
  name: string;
};

type TaskScope = 'SMIF' | 'CIPAVD';
type CreateKind = 'task' | 'meeting';

type LocalityCatalogItem = {
  id?: string | number | null;
  name?: string | null;
  code?: string | null;
  recruitsFemaleCountCurrent?: number | null;
  updatedAt?: Date | string | null;
};

type DashboardLocalityItem = {
  localityId?: string | number | null;
  localityName?: string | null;
};

type TaskTemplateItem = {
  id: string;
  [key: string]: unknown;
};

type PhaseItem = {
  id: string;
  name?: string | null;
  displayName?: string | null;
};

type TaskInstanceItem = {
  id: string;
  taskTemplateId?: string | null;
  localityId?: string | null;
  status?: string;
  taskTemplate?: TaskTemplateItem;
  [key: string]: unknown;
};

type CalendarTaskItem = {
  taskInstanceId: string;
  title: string;
  date: string | Date;
};

type MissionItem = {
  id: string;
  title?: string;
  startDate: string;
  endDate: string;
  locality?: { name?: string };
  localityId?: string | null;
};

type ActivityItem = {
  id: string;
  title?: string | null;
  eventDate?: string | Date | null;
  locality?: { name?: string };
  localityId?: string | null;
  activityType?: { name?: string };
};

type MeetingItem = {
  id: string;
  scope?: string;
  datetime?: string;
  status?: string;
  meetingType?: string;
  location?: string | null;
  locality?: { name?: string };
  localityId?: string | null;
};

type CreateTaskForm = {
  scope: TaskScope;
  title: string;
  description: string;
  phaseId: string;
  dueDate: string;
  priority: string;
  localityIds: string[];
};

type CreateMeetingForm = {
  datetime: string;
  scope: string;
  status: string;
  meetingType: string;
  location: string;
  meetingLink: string;
  localityId: string;
  agenda: string;
};

function formatDateRange(startIso: string, endIso: string): string {
  try {
    const start = parseISO(startIso);
    const end = parseISO(endIso);
    return `${format(start, 'dd/MM/yyyy', { locale: ptBR })} a ${format(end, 'dd/MM/yyyy', { locale: ptBR })}`;
  } catch {
    return `${startIso} a ${endIso}`;
  }
}

function toIsoDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString?.().slice(0, 10) ?? '';
}

function getDefaultDateForYear(year: number): Date {
  const now = new Date();
  return year === now.getFullYear()
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
    : new Date(year, 0, 1);
}

function toDateInputValue(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function toDatetimeInputValue(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

function withDefaultMeetingTime(date: Date): Date {
  const next = new Date(date.getTime());
  if (
    next.getHours() === 0 &&
    next.getMinutes() === 0 &&
    next.getSeconds() === 0 &&
    next.getMilliseconds() === 0
  ) {
    next.setHours(9, 0, 0, 0);
  }
  return next;
}

function readMultiSelectValue(value: unknown) {
  return Array.isArray(value)
    ? value.map(String).filter(Boolean)
    : String(value ?? '')
        .split(',')
        .filter(Boolean);
}

export function CalendarPage() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: me } = useMe();
  const localityId = params.get('localityId') ?? '';
  const canViewMeetings = can(me, 'meetings', 'view');
  const canCreateTask = can(me, 'task_instances', 'create');
  const canCreateMeeting = can(me, 'meetings', 'create');
  const canCreateAnyCalendarItem = canCreateTask || canCreateMeeting;

  const calendarQuery = useCalendarYear(year, {
    localityId: localityId || undefined,
  });
  const dashboardQuery = useDashboardNational({
    localityId: localityId || undefined,
  });
  const tasksQuery = useTasks({
    dueFrom: YEAR_START(year),
    dueTo: YEAR_END(year),
    localityId: localityId || undefined,
  });
  const templatesQuery = useTaskTemplates();
  const phasesQuery = usePhases();
  const cipavdLocalitiesQuery = useCipavdLocalities(canCreateTask);
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
  const meetingsQuery = useMeetings(
    {
      localityId: localityId || undefined,
      from: YEAR_START_DATETIME(year),
      to: YEAR_END_DATETIME(year),
      pageSize: 'all',
    },
    canViewMeetings,
  );
  const createTaskInstance = useCreateTaskInstance();
  const createMeeting = useCreateMeeting();

  const defaultCreateDate = getDefaultDateForYear(year);
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [createKind, setCreateKind] = useState<CreateKind>(
    canCreateTask ? 'task' : 'meeting',
  );
  const [createTaskForm, setCreateTaskForm] = useState<CreateTaskForm>(() => ({
    scope: 'SMIF',
    title: '',
    description: '',
    phaseId: '',
    dueDate: toDateInputValue(defaultCreateDate),
    priority: 'MEDIUM',
    localityIds: localityId ? [localityId] : [],
  }));
  const [createMeetingForm, setCreateMeetingForm] = useState<CreateMeetingForm>(
    () => ({
      datetime: toDatetimeInputValue(defaultCreateDate),
      scope: '',
      status: 'PLANNED',
      meetingType: 'PRESENCIAL',
      location: '',
      meetingLink: '',
      localityId,
      agenda: '',
    }),
  );

  const localitiesCatalogQuery = useLocalities();
  /** Catálogo completo só para resolver nomes; o drawer de tarefa usa localidades SMIF-alvo. */
  const localityNameCatalog = useMemo(() => {
    const items = (localitiesCatalogQuery.data?.items ??
      []) as LocalityCatalogItem[];
    return items
      .map((loc) => ({
        id: String(loc.id),
        name: String(loc.name ?? loc.code ?? loc.id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [localitiesCatalogQuery.data?.items]);

  const smifLocalitiesForTaskDrawer = useMemo(() => {
    const items = (localitiesCatalogQuery.data?.items ??
      []) as LocalityCatalogItem[];
    if (!items.length) return [];
    return selectTargetLocalities(items).map((loc) => ({
      id: String(loc.id),
      name: String(loc.name ?? loc.code ?? loc.id),
    }));
  }, [localitiesCatalogQuery.data?.items]);

  const localities = useMemo<LocalityOption[]>(
    () =>
      selectTargetLocalities(
        ((dashboardQuery.data?.items ?? []) as DashboardLocalityItem[]).map(
          (loc) => ({
            id: loc.localityId,
            name: loc.localityName,
          }),
        ),
      )
        .filter(
          (loc) => String(loc.id ?? '').trim() && String(loc.name ?? '').trim(),
        )
        .map((loc) => ({
          id: String(loc.id),
          name: String(loc.name),
        })),
    [dashboardQuery.data?.items],
  );
  const localityMap = useMemo(() => {
    const m = new Map(localityNameCatalog.map((l) => [l.id, l.name]));
    for (const loc of localities) {
      const id = String(loc.id ?? '');
      if (id && !m.has(id)) m.set(id, String(loc.name ?? id));
    }
    return m;
  }, [localityNameCatalog, localities]);

  const cipavdTaskLocalities = useMemo<LocalityOption[]>(() => {
    const items = (cipavdLocalitiesQuery.data?.items ??
      []) as LocalityCatalogItem[];
    return items
      .map((loc) => ({
        id: String(loc.id),
        name: String(loc.name ?? loc.code ?? loc.id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [cipavdLocalitiesQuery.data?.items]);

  const createTaskLocalityOptions =
    createTaskForm.scope === 'CIPAVD'
      ? cipavdTaskLocalities
      : localityNameCatalog;

  const phases = useMemo(
    () =>
      ((phasesQuery.data?.items ?? []) as PhaseItem[])
        .map((phase) => ({
          id: String(phase.id),
          name: String(phase.displayName ?? phase.name ?? phase.id),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [phasesQuery.data?.items],
  );

  const tasks = useMemo<TaskInstanceItem[]>(() => {
    const templateMap = new Map(
      ((templatesQuery.data?.items ?? []) as TaskTemplateItem[]).map(
        (template) => [template.id, template],
      ),
    );
    return ((tasksQuery.data?.items ?? []) as TaskInstanceItem[]).map(
      (task) => ({
        ...task,
        taskTemplate: task.taskTemplateId
          ? templateMap.get(task.taskTemplateId)
          : undefined,
      }),
    );
  }, [tasksQuery.data?.items, templatesQuery.data?.items]);

  const events = useMemo((): CalendarEventInput[] => {
    const yearStart = YEAR_START(year);
    const yearEnd = YEAR_END(year);
    const taskById = new Map(tasks.map((task) => [task.id, task]));

    const taskEvents: CalendarEventInput[] = (
      (calendarQuery.data?.items ?? []) as CalendarTaskItem[]
    ).map((item) => {
      const task = taskById.get(item.taskInstanceId);
      const localityName = task?.localityId
        ? localityMap.get(task.localityId)
        : null;
      return {
        id: item.taskInstanceId,
        title: item.title,
        date: item.date,
        status: task?.status,
        kind: 'task',
        subtitle: localityName
          ? `${localityName} • ${TASK_STATUS_LABELS[task?.status ?? ''] ?? task?.status ?? ''}`
          : (TASK_STATUS_LABELS[task?.status ?? ''] ?? task?.status ?? ''),
      };
    });

    const missionItems = (missionsQuery.data?.items ?? []) as MissionItem[];
    const missionEvents: CalendarEventInput[] = missionItems
      .filter(
        (m) =>
          m.startDate &&
          m.endDate &&
          m.startDate <= yearEnd &&
          m.endDate >= yearStart,
      )
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
      ...((activitiesSmifQuery.data?.items ?? []) as ActivityItem[]),
      ...((activitiesCipavdQuery.data?.items ?? []) as ActivityItem[]),
    ];
    const activityEvents: CalendarEventInput[] = allActivities
      .filter((a) => {
        const dateStr = toIsoDate(a.eventDate);
        return dateStr >= yearStart && dateStr <= yearEnd;
      })
      .map((a) => {
        const dateStr = toIsoDate(a.eventDate);
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

    const meetingItems = (meetingsQuery.data?.items ?? []) as MeetingItem[];
    const meetingEvents: CalendarEventInput[] = meetingItems.flatMap(
      (meeting) => {
        const meetingDate = meeting.datetime
          ? new Date(meeting.datetime)
          : null;
        if (!meetingDate || Number.isNaN(meetingDate.getTime())) return [];
        if (meetingDate.getFullYear() !== year) return [];

        const endDate = new Date(meetingDate.getTime() + 60 * 60 * 1000);
        const locName =
          meeting.locality?.name ?? localityMap.get(meeting.localityId ?? '');
        const statusLabel =
          MEETING_STATUS_LABELS[meeting.status ?? ''] ?? meeting.status ?? '';
        const timeLabel = format(meetingDate, 'HH:mm', { locale: ptBR });

        return [
          {
            id: `meeting:${meeting.id}`,
            title: meeting.scope?.trim() || 'Reunião',
            date: meetingDate,
            endDate,
            allDay: false,
            kind: 'meeting' as const,
            status: meeting.status,
            subtitle: [timeLabel, locName, statusLabel]
              .filter(Boolean)
              .join(' • '),
          },
        ];
      },
    );

    return [
      ...taskEvents,
      ...missionEvents,
      ...activityEvents,
      ...meetingEvents,
    ];
  }, [
    year,
    calendarQuery.data?.items,
    tasks,
    localityMap,
    missionsQuery.data?.items,
    activitiesSmifQuery.data?.items,
    activitiesCipavdQuery.data?.items,
    meetingsQuery.data?.items,
  ]);

  /** Referência estável para não resetar a navegação do calendário a cada render do pai. */
  const calendarSeedDate = useMemo(() => {
    return getDefaultDateForYear(year);
  }, [year]);

  const resolvePermittedCreateKind = (
    preferred?: CreateKind,
  ): CreateKind | null => {
    if (preferred === 'task' && canCreateTask) return 'task';
    if (preferred === 'meeting' && canCreateMeeting) return 'meeting';
    if (canCreateTask) return 'task';
    if (canCreateMeeting) return 'meeting';
    return null;
  };

  const buildCreateTaskForm = (date: Date): CreateTaskForm => ({
    scope: 'SMIF',
    title: '',
    description: '',
    phaseId: '',
    dueDate: toDateInputValue(date),
    priority: 'MEDIUM',
    localityIds: localityId ? [localityId] : [],
  });

  const buildCreateMeetingForm = (date: Date): CreateMeetingForm => ({
    datetime: toDatetimeInputValue(withDefaultMeetingTime(date)),
    scope: '',
    status: 'PLANNED',
    meetingType: 'PRESENCIAL',
    location: '',
    meetingLink: '',
    localityId,
    agenda: '',
  });

  const openCreateDrawer = (
    preferred?: CreateKind,
    date = calendarSeedDate,
  ) => {
    const nextKind = resolvePermittedCreateKind(preferred);
    if (!nextKind) return;
    setCreateKind(nextKind);
    setCreateTaskForm(buildCreateTaskForm(date));
    setCreateMeetingForm(buildCreateMeetingForm(date));
    setCreateDrawerOpen(true);
  };

  const handleCreateTaskScopeChange = (scope: TaskScope) => {
    setCreateTaskForm((current) => ({
      ...current,
      scope,
      localityIds: scope === 'SMIF' && localityId ? [localityId] : [],
    }));
  };

  const handleCreateTask = async () => {
    if (!canCreateTask) return;
    if (!createTaskForm.title.trim()) {
      toast.push({
        message: 'Informe o título da tarefa.',
        severity: 'warning',
      });
      return;
    }
    if (!createTaskForm.phaseId) {
      toast.push({
        message: 'Selecione a fase da tarefa.',
        severity: 'warning',
      });
      return;
    }
    if (!createTaskForm.dueDate) {
      toast.push({
        message: 'Informe o prazo da tarefa.',
        severity: 'warning',
      });
      return;
    }
    if (!createTaskForm.localityIds.length) {
      toast.push({
        message: 'Selecione ao menos uma localidade para a tarefa.',
        severity: 'warning',
      });
      return;
    }

    const dueDate = new Date(`${createTaskForm.dueDate}T00:00:00`);
    if (Number.isNaN(dueDate.getTime())) {
      toast.push({ message: 'Prazo da tarefa inválido.', severity: 'warning' });
      return;
    }

    try {
      const response = (await createTaskInstance.mutateAsync({
        scope: createTaskForm.scope,
        title: createTaskForm.title.trim(),
        description: createTaskForm.description.trim() || null,
        phaseId: createTaskForm.phaseId,
        dueDate: dueDate.toISOString(),
        priority: createTaskForm.priority,
        localityIds: createTaskForm.localityIds,
        assignedToId: null,
        assigneeIds: [],
      })) as { items?: Array<{ id?: string | number | null }> };

      const createdYear = dueDate.getFullYear();
      if (createdYear !== year) setYear(createdYear);
      if (localityId && !createTaskForm.localityIds.includes(localityId)) {
        updateParam('localityId', createTaskForm.localityIds[0] ?? '');
      }

      const firstCreatedId = response.items?.[0]?.id;
      if (firstCreatedId) setSelectedTaskId(String(firstCreatedId));
      setCreateDrawerOpen(false);
      toast.push({
        message: 'Tarefa criada e adicionada ao calendário.',
        severity: 'success',
      });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? 'Erro ao criar tarefa.',
        severity: 'error',
      });
    }
  };

  const handleCreateMeeting = async () => {
    if (!canCreateMeeting) return;
    if (!createMeetingForm.datetime) {
      toast.push({
        message: 'Informe a data e hora da reunião.',
        severity: 'warning',
      });
      return;
    }
    if (!createMeetingForm.scope.trim()) {
      toast.push({
        message: 'Informe o assunto da reunião.',
        severity: 'warning',
      });
      return;
    }

    const meetingDate = new Date(createMeetingForm.datetime);
    if (Number.isNaN(meetingDate.getTime())) {
      toast.push({
        message: 'Data e hora da reunião inválidas.',
        severity: 'warning',
      });
      return;
    }
    if (
      createMeetingForm.meetingType === 'PRESENCIAL' &&
      !createMeetingForm.location.trim()
    ) {
      toast.push({
        message: 'Informe o local da reunião presencial.',
        severity: 'warning',
      });
      return;
    }
    if (
      createMeetingForm.meetingType === 'ONLINE' &&
      !createMeetingForm.meetingLink.trim()
    ) {
      toast.push({
        message: 'Informe o link da reunião online.',
        severity: 'warning',
      });
      return;
    }

    try {
      await createMeeting.mutateAsync({
        datetime: meetingDate.toISOString(),
        scope: createMeetingForm.scope.trim(),
        status: createMeetingForm.status,
        meetingType: createMeetingForm.meetingType,
        location:
          createMeetingForm.meetingType === 'PRESENCIAL'
            ? createMeetingForm.location.trim()
            : null,
        meetingLink:
          createMeetingForm.meetingType === 'ONLINE'
            ? createMeetingForm.meetingLink.trim()
            : null,
        localityId: createMeetingForm.localityId || null,
        agenda: createMeetingForm.agenda.trim() || null,
        participantIds: [],
      });

      const createdYear = meetingDate.getFullYear();
      if (createdYear !== year) setYear(createdYear);
      if (localityId !== createMeetingForm.localityId) {
        updateParam('localityId', createMeetingForm.localityId);
      }
      setCreateDrawerOpen(false);
      toast.push({
        message: 'Reunião criada e adicionada ao calendário.',
        severity: 'success',
      });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? 'Erro ao criar reunião.',
        severity: 'error',
      });
    }
  };

  const handleSelectCalendarSlot = (date: Date) => {
    openCreateDrawer(undefined, date);
  };

  const selectedTaskFromList =
    tasks.find((item) => item.id === selectedTaskId) ?? null;
  const selectedTaskIsLinkedEntity = Boolean(
    selectedTaskId &&
    (selectedTaskId.startsWith('mission:') ||
      selectedTaskId.startsWith('activity:') ||
      selectedTaskId.startsWith('meeting:')),
  );
  const selectedTaskQuery = useTaskInstance(
    selectedTaskId ?? '',
    Boolean(selectedTaskId) &&
      !selectedTaskFromList &&
      !selectedTaskIsLinkedEntity,
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
    if (id.startsWith('meeting:')) {
      const meetingId = id.slice('meeting:'.length);
      navigate(`/meetings?meetingId=${encodeURIComponent(meetingId)}`);
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
  if (calendarQuery.isError)
    return (
      <ErrorState
        error={calendarQuery.error}
        onRetry={() => calendarQuery.refetch()}
      />
    );

  return (
    <Box sx={{ pb: 0.2 }}>
      <Typography variant="h4" gutterBottom fontWeight={700} sx={{ mb: 0.5 }}>
        Calendário
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Tarefas, missões, atividades de campo e reuniões no mesmo calendário.
        Clique em um evento para abrir detalhes ou ir à tela correspondente.
      </Typography>
      <Card sx={{ mb: 1 }}>
        <CardContent
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1.2,
            alignItems: 'center',
            py: 1.4,
          }}
        >
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
          <Box sx={{ flexGrow: 1 }} />
          {canCreateTask ? (
            <Button
              variant="contained"
              size="small"
              startIcon={<AddTaskRoundedIcon />}
              onClick={() => openCreateDrawer('task')}
            >
              Nova tarefa
            </Button>
          ) : null}
          {canCreateMeeting ? (
            <Button
              variant="outlined"
              size="small"
              startIcon={<EventAvailableRoundedIcon />}
              onClick={() => openCreateDrawer('meeting')}
            >
              Nova reunião
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card sx={{ overflow: 'hidden' }}>
        <Box sx={{ px: { xs: 0.7, md: 0.9 }, pt: 0.7 }}>
          <Stack
            direction="row"
            flexWrap="wrap"
            gap={1}
            alignItems="center"
            sx={{ mb: 0.5 }}
          >
            <Chip
              size="small"
              label="Tarefas"
              sx={{
                bgcolor: '#E3F2FD',
                borderColor: '#1565C0',
                border: '1px solid',
              }}
            />
            <Chip
              size="small"
              label="Missões"
              sx={{
                bgcolor: '#EDE7F6',
                borderColor: '#5E35B1',
                border: '1px solid',
              }}
            />
            <Chip
              size="small"
              label="Atividades de campo"
              sx={{
                bgcolor: '#E0F2F1',
                borderColor: '#00695C',
                border: '1px solid',
              }}
            />
            {canViewMeetings ? (
              <Chip
                size="small"
                label="Reuniões"
                sx={{
                  bgcolor: '#FFF8E1',
                  borderColor: '#F57C00',
                  border: '1px solid',
                }}
              />
            ) : null}
            {events.length === 0 ? (
              <Chip size="small" label="Sem eventos no período" />
            ) : null}
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
            onSelectSlot={
              canCreateAnyCalendarItem ? handleSelectCalendarSlot : undefined
            }
            height="100%"
            date={calendarSeedDate}
          />
        </Box>
      </Card>

      <Drawer
        anchor="right"
        open={createDrawerOpen}
        onClose={() => setCreateDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', md: 520 } } }}
      >
        <Box
          p={3}
          display="flex"
          flexDirection="column"
          gap={2}
          height="100%"
          sx={{ overflowY: 'auto', pt: { xs: 10, md: 9 } }}
        >
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Novo item no calendário
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              O item criado aparece no calendário após a confirmação.
            </Typography>
          </Box>

          {canCreateTask && canCreateMeeting ? (
            <Tabs
              value={createKind}
              onChange={(_, value: CreateKind) => setCreateKind(value)}
              variant="fullWidth"
            >
              <Tab
                value="task"
                label="Tarefa"
                icon={<AddTaskRoundedIcon />}
                iconPosition="start"
              />
              <Tab
                value="meeting"
                label="Reunião"
                icon={<EventAvailableRoundedIcon />}
                iconPosition="start"
              />
            </Tabs>
          ) : (
            <Chip
              icon={
                createKind === 'task' ? (
                  <AddTaskRoundedIcon />
                ) : (
                  <EventAvailableRoundedIcon />
                )
              }
              label={createKind === 'task' ? 'Nova tarefa' : 'Nova reunião'}
              sx={{ alignSelf: 'flex-start' }}
            />
          )}

          <Divider />

          {createKind === 'task' && canCreateTask ? (
            <Stack spacing={2}>
              <TextField
                select
                size="small"
                label="Escopo"
                value={createTaskForm.scope}
                onChange={(event) =>
                  handleCreateTaskScopeChange(event.target.value as TaskScope)
                }
              >
                <MenuItem value="SMIF">SMIF</MenuItem>
                <MenuItem value="CIPAVD">CIPAVD</MenuItem>
              </TextField>
              <TextField
                size="small"
                label="Título"
                value={createTaskForm.title}
                onChange={(event) =>
                  setCreateTaskForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Ex.: Preparar pauta da reunião"
                required
              />
              <TextField
                size="small"
                label="Descrição"
                value={createTaskForm.description}
                onChange={(event) =>
                  setCreateTaskForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                multiline
                minRows={3}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <TextField
                  select
                  size="small"
                  label="Fase"
                  value={createTaskForm.phaseId}
                  onChange={(event) =>
                    setCreateTaskForm((current) => ({
                      ...current,
                      phaseId: event.target.value,
                    }))
                  }
                  required
                  fullWidth
                >
                  {phases.map((phase) => (
                    <MenuItem key={phase.id} value={phase.id}>
                      {phase.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  size="small"
                  type="date"
                  label="Prazo"
                  InputLabelProps={{ shrink: true }}
                  value={createTaskForm.dueDate}
                  onChange={(event) =>
                    setCreateTaskForm((current) => ({
                      ...current,
                      dueDate: event.target.value,
                    }))
                  }
                  required
                  fullWidth
                />
              </Stack>
              <TextField
                select
                size="small"
                label="Prioridade"
                value={createTaskForm.priority}
                onChange={(event) =>
                  setCreateTaskForm((current) => ({
                    ...current,
                    priority: event.target.value,
                  }))
                }
              >
                {TaskPriority.map((priority) => (
                  <MenuItem key={priority} value={priority}>
                    {TASK_PRIORITY_LABELS[priority] ?? priority}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="Localidades"
                SelectProps={{ multiple: true }}
                value={createTaskForm.localityIds}
                onChange={(event) =>
                  setCreateTaskForm((current) => ({
                    ...current,
                    localityIds: readMultiSelectValue(event.target.value),
                  }))
                }
                helperText={
                  createTaskLocalityOptions.length
                    ? 'Selecione uma ou mais localidades.'
                    : 'Nenhuma localidade disponível para este escopo.'
                }
                required
              >
                {createTaskLocalityOptions.map((loc) => (
                  <MenuItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </MenuItem>
                ))}
              </TextField>
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button
                  variant="text"
                  onClick={() => setCreateDrawerOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="contained"
                  startIcon={<AddTaskRoundedIcon />}
                  onClick={handleCreateTask}
                  disabled={createTaskInstance.isPending}
                >
                  {createTaskInstance.isPending ? 'Criando...' : 'Criar tarefa'}
                </Button>
              </Stack>
            </Stack>
          ) : null}

          {createKind === 'meeting' && canCreateMeeting ? (
            <Stack spacing={2}>
              <TextField
                size="small"
                type="datetime-local"
                label="Data e hora"
                InputLabelProps={{ shrink: true }}
                value={createMeetingForm.datetime}
                onChange={(event) =>
                  setCreateMeetingForm((current) => ({
                    ...current,
                    datetime: event.target.value,
                  }))
                }
                required
              />
              <TextField
                size="small"
                label="Assunto"
                value={createMeetingForm.scope}
                onChange={(event) =>
                  setCreateMeetingForm((current) => ({
                    ...current,
                    scope: event.target.value,
                  }))
                }
                placeholder="Ex.: Alinhamento de fases"
                multiline
                minRows={2}
                required
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <TextField
                  select
                  size="small"
                  label="Status"
                  value={createMeetingForm.status}
                  onChange={(event) =>
                    setCreateMeetingForm((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                  fullWidth
                >
                  {Object.entries(MEETING_STATUS_LABELS).map(
                    ([status, label]) => (
                      <MenuItem key={status} value={status}>
                        {label}
                      </MenuItem>
                    ),
                  )}
                </TextField>
                <TextField
                  select
                  size="small"
                  label="Tipo"
                  value={createMeetingForm.meetingType}
                  onChange={(event) =>
                    setCreateMeetingForm((current) => ({
                      ...current,
                      meetingType: event.target.value,
                    }))
                  }
                  fullWidth
                >
                  {MeetingType.map((type) => (
                    <MenuItem key={type} value={type}>
                      {MEETING_TYPE_LABELS[type] ?? type}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
              {createMeetingForm.meetingType === 'PRESENCIAL' ? (
                <TextField
                  size="small"
                  label="Local"
                  value={createMeetingForm.location}
                  onChange={(event) =>
                    setCreateMeetingForm((current) => ({
                      ...current,
                      location: event.target.value,
                    }))
                  }
                  placeholder="Ex.: Sala de briefing"
                  required
                />
              ) : (
                <TextField
                  size="small"
                  label="Link da reunião"
                  value={createMeetingForm.meetingLink}
                  onChange={(event) =>
                    setCreateMeetingForm((current) => ({
                      ...current,
                      meetingLink: event.target.value,
                    }))
                  }
                  placeholder="https://..."
                  required
                />
              )}
              <TextField
                select
                size="small"
                label="Localidade"
                value={createMeetingForm.localityId}
                onChange={(event) =>
                  setCreateMeetingForm((current) => ({
                    ...current,
                    localityId: event.target.value,
                  }))
                }
                helperText="Opcional. Use para manter a reunião visível ao filtrar por localidade."
              >
                <MenuItem value="">Geral</MenuItem>
                {localityNameCatalog.map((loc) => (
                  <MenuItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                size="small"
                label="Pauta"
                value={createMeetingForm.agenda}
                onChange={(event) =>
                  setCreateMeetingForm((current) => ({
                    ...current,
                    agenda: event.target.value,
                  }))
                }
                multiline
                minRows={3}
              />
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button
                  variant="text"
                  onClick={() => setCreateDrawerOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="contained"
                  startIcon={<EventAvailableRoundedIcon />}
                  onClick={handleCreateMeeting}
                  disabled={createMeeting.isPending}
                >
                  {createMeeting.isPending ? 'Criando...' : 'Criar reunião'}
                </Button>
              </Stack>
            </Stack>
          ) : null}
        </Box>
      </Drawer>

      {selectedTaskId ? (
        <TaskDetailsDrawer
          task={selectedTask}
          open
          onClose={() => setSelectedTaskId(null)}
          onDeleted={() => setSelectedTaskId(null)}
          user={me}
          localities={
            smifLocalitiesForTaskDrawer.length > 0
              ? smifLocalitiesForTaskDrawer
              : localities
          }
          loading={!selectedTaskFromList && selectedTaskQuery.isLoading}
        />
      ) : null}
    </Box>
  );
}
