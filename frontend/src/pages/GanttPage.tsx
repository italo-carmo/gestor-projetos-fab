import { Box, Button, ButtonGroup, Card, CardContent, Chip, MenuItem, TextField, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLocalities, useGantt, usePhases, useTaskTemplates, useMe } from '../api/hooks';
import { SkeletonState } from '../components/states/SkeletonState';
import { ErrorState } from '../components/states/ErrorState';
import { EmptyState } from '../components/states/EmptyState';
import { GanttView } from '../components/gantt/GanttView';
import { TaskDetailsDrawer } from '../components/tasks/TaskDetailsDrawer';
import { TASK_STATUS_LABELS } from '../constants/enums';
import { selectTargetLocalities } from '../constants/localities';

export function GanttPage() {
  const [params, setParams] = useSearchParams();
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
  const localitiesQuery = useLocalities();
  const phasesQuery = usePhases();
  const templatesQuery = useTaskTemplates();

  const templateMap = new Map<string, any>(((templatesQuery.data?.items ?? []) as any[]).map((t: any) => [t.id, t]));

  const localities = selectTargetLocalities((localitiesQuery.data?.items ?? []) as any[]).map((loc: any) => ({
    id: loc.id,
    name: loc.name ?? loc.code ?? loc.id,
  }));
  const localityNameMap = new Map(localities.map((l: any) => [l.id, l.name]));

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
      taskTemplate: template,
      taskTitle: resolveTaskTitle(task),
      phaseName: resolveTaskPhaseName(task, template),
      localityName: resolveTaskLocalityName(task),
    };
  });

  const groupedItems = useMemo(() => {
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

  const selectedTask =
    groupedItems.find((item: any) => item.id === selectedTaskId) ?? null;

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  if (ganttQuery.isLoading) return <SkeletonState />;
  if (ganttQuery.isError) return <ErrorState error={ganttQuery.error} onRetry={() => ganttQuery.refetch()} />;

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight={700}>
        Cronograma (Gantt)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Visão de tarefas ao longo do tempo. Clique em uma barra para ver detalhes.
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

      {groupedItems.length === 0 ? (
        <EmptyState title="Sem tarefas" description="Nenhum item para o período selecionado. Ajuste os filtros ou datas." />
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
              <Chip size="small" label={`${groupedItems.length} tarefas`} variant="outlined" />
              <Typography variant="caption" color="text.secondary">
                Dica: clique e arraste no gráfico para navegar pelos meses (também funciona com rolagem).
              </Typography>
            </Box>
            <GanttView items={groupedItems} onSelect={(id) => setSelectedTaskId(id)} viewMode={viewMode} />
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
        linkedTaskIds={selectedTask?.groupedTaskIds ?? []}
        linkedLocalities={selectedTask?.groupedLocalities ?? []}
      />
    </Box>
  );
}
