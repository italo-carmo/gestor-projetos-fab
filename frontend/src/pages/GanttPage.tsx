import { Box, Button, ButtonGroup, Card, CardContent, Chip, MenuItem, TextField, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useActivities, useLocalities, useGantt, usePhases, useTaskTemplates, useMe } from '../api/hooks';
import { SkeletonState } from '../components/states/SkeletonState';
import { ErrorState } from '../components/states/ErrorState';
import { EmptyState } from '../components/states/EmptyState';
import { GanttView } from '../components/gantt/GanttView';
import { TaskDetailsDrawer } from '../components/tasks/TaskDetailsDrawer';
import { TASK_STATUS_LABELS } from '../constants/enums';
import { selectTargetLocalities } from '../constants/localities';

const ACTIVITY_PROGRESS_BY_STATUS: Record<string, number> = {
  DONE: 100,
  IN_PROGRESS: 60,
  STARTED: 35,
  NOT_STARTED: 0,
};

function toDateOrNull(value: string) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return null;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isInRange(date: Date, fromDate: Date | null, toDate: Date | null) {
  if (fromDate && date < fromDate) return false;
  if (toDate && date > toDate) return false;
  return true;
}

export function GanttPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'Day' | 'Week' | 'Month'>('Week');
  const { data: me } = useMe();

  const localityId = params.get('localityId') ?? '';
  const phaseId = params.get('phaseId') ?? '';
  const status = params.get('status') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';

  const filters = useMemo(
    () => ({
      localityId: localityId || undefined,
      phaseId: phaseId || undefined,
      status: status || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
    [localityId, phaseId, status, from, to],
  );

  const ganttQuery = useGantt(filters);
  const activitiesQuery = useActivities({
    localityId: localityId || undefined,
    status: status || undefined,
    pageSize: '500',
  });
  const localitiesQuery = useLocalities();
  const phasesQuery = usePhases();
  const templatesQuery = useTaskTemplates();

  const templateMap = new Map<string, any>(((templatesQuery.data?.items ?? []) as any[]).map((t: any) => [t.id, t]));

  const localitiesRaw = (localitiesQuery.data?.items ?? []) as any[];
  /** Nomes no gráfico; edição de tarefa usa só `localities` (SMIF-alvo). */
  const localityNameCatalog = useMemo(
    () =>
      localitiesRaw
        .map((loc: any) => ({
          id: String(loc.id),
          name: String(loc.name ?? loc.code ?? loc.id),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [localitiesRaw],
  );
  const localities = selectTargetLocalities(localitiesRaw).map((loc: any) => ({
    id: loc.id,
    name: loc.name ?? loc.code ?? loc.id,
  }));
  const localityNameMap = new Map(localityNameCatalog.map((l: any) => [l.id, l.name]));

  const phases = ((phasesQuery.data?.items ?? []) as any[]).map((phase: any) => ({
    id: phase.id,
    name: phase.name,
  }));
  const phaseMap = new Map(phases.map((phase) => [phase.id, phase.name]));

  const resolveTaskTitle = (task: any) => {
    const raw = task?.taskTemplate?.title ?? task?.title ?? task?.taskTitle ?? '';
    const normalized = String(raw).trim();
    return normalized || 'Tarefa sem título';
  };

  const resolveTaskPhaseName = (task: any, template: any) => {
    const direct = String(task?.phaseName ?? '').trim();
    if (direct) return direct;

    const fromTaskTemplate = String(
      task?.taskTemplate?.phase?.displayName ?? task?.taskTemplate?.phase?.name ?? '',
    ).trim();
    if (fromTaskTemplate) return fromTaskTemplate;

    const fromTemplate = String(
      template?.phase?.displayName ?? template?.phase?.name ?? '',
    ).trim();
    if (fromTemplate) return fromTemplate;

    const fromMap = template?.phaseId ? phaseMap.get(template.phaseId) : undefined;
    if (fromMap && String(fromMap).trim()) return String(fromMap).trim();

    return 'Sem fase';
  };

  const resolveTaskLocalityName = (task: any) => {
    const direct = String(task?.localityName ?? task?.locality?.name ?? '').trim();
    if (direct) return direct;

    const mapped = localityNameMap.get(task.localityId);
    if (mapped && String(mapped).trim()) return String(mapped).trim();

    const code = String(task?.localityCode ?? task?.locality?.code ?? '').trim();
    if (code) return code;

    return '—';
  };

  const baseItems = ((ganttQuery.data?.items ?? []) as any[]).map((task: any) => {
    const template = task.taskTemplate ?? templateMap.get(task.taskTemplateId) ?? null;
    return {
      ...task,
      itemType: 'task' as const,
      entityId: String(task.id),
      taskTemplate: template,
      taskTitle: resolveTaskTitle(task),
      phaseName: resolveTaskPhaseName(task, template),
      localityName: resolveTaskLocalityName(task),
    };
  });

  const groupedTaskItems = useMemo(() => {
    const filtered = baseItems
      .filter((task: any) => (phaseId ? task.taskTemplate?.phaseId === phaseId : true))
      .filter((task: any) => (status ? task.status === status : true));

    const groups = new Map<string, any[]>();
    for (const task of filtered) {
      const explicitGroupKey = String(task.groupKey ?? "").trim();
      const createdDateKey =
        String(task.createdAt ?? "").slice(0, 10) ||
        String(task.dueDate ?? "").slice(0, 10);
      const phaseKey = String(task.taskTemplate?.phaseId ?? "");
      const templateKey = String(task.taskTemplateId ?? task.taskTemplate?.id ?? "");
      const meetingKey = String(task.meetingId ?? "");
      const specialtyKey = String(task.specialtyId ?? "");
      const eloRoleKey = String(task.eloRoleId ?? "");
      const titleKey = resolveTaskTitle(task).trim().toLowerCase();
      const fallbackLegacyKey =
        `legacy:${templateKey}|${titleKey}|${phaseKey}|${createdDateKey}|${meetingKey}|${specialtyKey}|${eloRoleKey}`;
      const key = explicitGroupKey || fallbackLegacyKey;
      const current = groups.get(key) ?? [];
      current.push(task);
      groups.set(key, current);
    }

    const rows: any[] = [];
    for (const [key, group] of Array.from(groups.entries())) {
      const uniqueLocalities = Array.from(
        new Set(group.map((item: any) => String(item.localityId ?? ""))),
      ).filter(Boolean);
      if (key.startsWith("legacy:") && uniqueLocalities.length <= 1 && group.length <= 1) {
        const task = group[0];
        rows.push({
          ...task,
          itemType: 'task',
          entityId: String(task.id),
          id: String(task.id),
          primaryTaskId: String(task.id),
          groupedTaskIds: [String(task.id)],
          groupedLocalities: [
            {
              id: String(task.localityId),
              name: String(task.localityName ?? "—"),
            },
          ],
          groupedLocalityCount: 1,
        });
        continue;
      }

      const ordered = [...group].sort(
        (a: any, b: any) =>
          new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      );
      const primary = ordered[0];
      const taskIds = ordered.map((item: any) => String(item.id));
      const localityEntries = ordered.map((item: any) => ({
        id: String(item.localityId),
        name: String(item.localityName ?? "—"),
      }));
      const dedupLocalityMap = new Map<string, { id: string; name: string }>();
      localityEntries.forEach((entry) => {
        if (!dedupLocalityMap.has(entry.id)) {
          dedupLocalityMap.set(entry.id, entry);
        }
      });
      const groupedLocalities = Array.from(dedupLocalityMap.values());
      const hasMixedStatus =
        new Set(ordered.map((item: any) => String(item.status))).size > 1;
      const averageProgress = Math.round(
        ordered.reduce(
          (acc: number, item: any) => acc + Number(item.progressPercent ?? 0),
          0,
        ) / ordered.length,
      );

      rows.push({
        ...primary,
        itemType: 'task',
        entityId: String(primary.id),
        id: String(primary.id),
        primaryTaskId: String(primary.id),
        groupedTaskIds: taskIds,
        groupedLocalities,
        groupedLocalityCount: groupedLocalities.length,
        localityName:
          groupedLocalities.length > 1
            ? `${groupedLocalities.length} localidades`
            : (groupedLocalities[0]?.name ?? "—"),
        status: hasMixedStatus ? "IN_PROGRESS" : primary.status,
        progressPercent: hasMixedStatus
          ? averageProgress
          : Number(primary.progressPercent ?? 0),
      });
    }

    return rows;
  }, [baseItems, phaseId, status]);

  const dateFrom = useMemo(() => (from ? toDateOrNull(`${from}T00:00:00`) : null), [from]);
  const dateTo = useMemo(() => (to ? toDateOrNull(`${to}T23:59:59.999`) : null), [to]);

  const activityItems = useMemo(() => {
    if (phaseId) return [];

    return ((activitiesQuery.data?.items ?? []) as any[])
      .map((activity: any) => {
        const eventDate = toDateOrNull(activity?.eventDate ?? activity?.createdAt ?? '');
        if (!eventDate) return null;
        if (!isInRange(eventDate, dateFrom, dateTo)) return null;

        const resolvedStatus = String(activity?.status ?? 'NOT_STARTED');
        return {
          id: `activity:${String(activity.id)}`,
          entityId: String(activity.id),
          itemType: 'activity' as const,
          taskTitle: String(activity?.title ?? '').trim() || 'Atividade sem título',
          phaseName: 'Atividade',
          localityId: String(activity?.localityId ?? ''),
          localityName: String(activity?.locality?.name ?? '').trim() || '—',
          dueDate: eventDate.toISOString(),
          progressPercent: ACTIVITY_PROGRESS_BY_STATUS[resolvedStatus] ?? 0,
          status: resolvedStatus,
          isLate: resolvedStatus !== 'DONE' && eventDate.getTime() < Date.now(),
        };
      })
      .filter(Boolean);
  }, [activitiesQuery.data?.items, dateFrom, dateTo, phaseId]);

  const allItems = useMemo(() => {
    return [...groupedTaskItems, ...activityItems].sort(
      (a: any, b: any) =>
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    );
  }, [activityItems, groupedTaskItems]);

  const selectedTask =
    groupedTaskItems.find((item: any) => item.id === selectedTaskId) ?? null;

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  if (ganttQuery.isLoading || activitiesQuery.isLoading) return <SkeletonState />;
  if (ganttQuery.isError) return <ErrorState error={ganttQuery.error} onRetry={() => ganttQuery.refetch()} />;
  if (activitiesQuery.isError) return <ErrorState error={activitiesQuery.error} onRetry={() => activitiesQuery.refetch()} />;

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight={700}>
        Cronograma (Gantt)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Visão de tarefas e atividades ao longo do tempo. Clique em uma barra para abrir os detalhes.
      </Typography>
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(5, 1fr)' } }}>
          <TextField
            select
            size="small"
            label="Localidade"
            value={localityId}
            onChange={(e) => updateParam('localityId', e.target.value)}
          >
            <MenuItem value="">Todas</MenuItem>
            {localities.map((loc) => (
              <MenuItem key={loc.id} value={loc.id}>
                {loc.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Fase"
            value={phaseId}
            onChange={(e) => updateParam('phaseId', e.target.value)}
          >
            <MenuItem value="">Todas</MenuItem>
            {phases.map((phase) => (
              <MenuItem key={phase.id} value={phase.id}>
                {phase.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Status"
            value={status}
            onChange={(e) => updateParam('status', e.target.value)}
          >
            <MenuItem value="">Todos</MenuItem>
            {['NOT_STARTED', 'STARTED', 'IN_PROGRESS', 'DONE'].map((s) => (
              <MenuItem key={s} value={s}>
                {TASK_STATUS_LABELS[s] ?? s}
              </MenuItem>
            ))}
          </TextField>
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
        </CardContent>
      </Card>

      {allItems.length === 0 ? (
        <EmptyState title="Sem itens" description="Nenhuma tarefa ou atividade para o período selecionado. Ajuste os filtros ou datas." />
      ) : (
        <Card>
          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Typography variant="body2" color="text.secondary">Visualização:</Typography>
              <ButtonGroup size="small">
                <Button variant={viewMode === 'Day' ? 'contained' : 'outlined'} onClick={() => setViewMode('Day')}>Dia</Button>
                <Button variant={viewMode === 'Week' ? 'contained' : 'outlined'} onClick={() => setViewMode('Week')}>Semana</Button>
                <Button variant={viewMode === 'Month' ? 'contained' : 'outlined'} onClick={() => setViewMode('Month')}>Mês</Button>
              </ButtonGroup>
              <Chip
                size="small"
                label={`${groupedTaskItems.length} tarefas • ${activityItems.length} atividades`}
                variant="outlined"
              />
              <Typography variant="caption" color="text.secondary">
                Dica: clique e arraste no gráfico (botão esquerdo ou botão do meio/mão) para navegar.
              </Typography>
            </Box>
            <GanttView
              items={allItems}
              onSelect={(item) => {
                if (item.itemType === 'activity') {
                  const next = new URLSearchParams();
                  if (localityId) next.set('localityId', localityId);
                  next.set('activityId', item.entityId);
                  navigate(`/activities?${next.toString()}`);
                  return;
                }
                setSelectedTaskId(item.entityId);
              }}
              viewMode={viewMode}
            />
          </Box>
        </Card>
      )}

      <TaskDetailsDrawer
        task={selectedTask}
        open={Boolean(selectedTask)}
        onClose={() => setSelectedTaskId(null)}
        onDeleted={() => setSelectedTaskId(null)}
        user={me}
        localities={localities}
        linkedTaskIds={selectedTask?.groupedTaskIds ?? []}
        linkedLocalities={selectedTask?.groupedLocalities ?? []}
      />
    </Box>
  );
}
