import { Box, Card, CardContent, TextField, Typography, MenuItem } from '@mui/material';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDashboardNational, useGantt, usePhases, useTaskTemplates, useMe } from '../api/hooks';
import { SkeletonState } from '../components/states/SkeletonState';
import { ErrorState } from '../components/states/ErrorState';
import { EmptyState } from '../components/states/EmptyState';
import { GanttView } from '../components/gantt/GanttView';
import { TaskDetailsDrawer } from '../components/tasks/TaskDetailsDrawer';

export function GanttPage() {
  const [params, setParams] = useSearchParams();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
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
  const dashboardQuery = useDashboardNational({});
  const phasesQuery = usePhases();
  const templatesQuery = useTaskTemplates();

  const templateMap = new Map((templatesQuery.data?.items ?? []).map((t: any) => [t.id, t]));

  const localities = (dashboardQuery.data?.items ?? []).map((loc: any) => ({
    id: loc.localityId,
    name: loc.localityName,
  }));

  const phases = (phasesQuery.data?.items ?? []).map((phase: any) => ({
    id: phase.id,
    name: phase.name,
  }));
  const phaseMap = new Map(phases.map((phase) => [phase.id, phase.name]));

  let items = (ganttQuery.data?.items ?? []).map((task: any) => {
    const template = templateMap.get(task.taskTemplateId);
    return {
      ...task,
      taskTemplate: template,
      phaseName: template ? phaseMap.get(template.phaseId) : undefined,
    };
  });
  if (phaseId) {
    items = items.filter((task: any) => task.taskTemplate?.phaseId === phaseId);
  }
  if (status) {
    items = items.filter((task: any) => task.status === status);
  }
  const selectedTask = items.find((item: any) => item.id === selectedTaskId) ?? null;

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
      <Typography variant="h4" gutterBottom>
        Gantt
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
            {['NOT_STARTED', 'STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE'].map((s) => (
              <MenuItem key={s} value={s}>
                {s}
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
            label="Ate"
            InputLabelProps={{ shrink: true }}
            value={to}
            onChange={(e) => updateParam('to', e.target.value)}
          />
        </CardContent>
      </Card>

      {items.length === 0 ? (
        <EmptyState title="Sem tarefas" description="Nao ha itens para o periodo selecionado." />
      ) : (
        <GanttView items={items} onSelect={(id) => setSelectedTaskId(id)} />
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
