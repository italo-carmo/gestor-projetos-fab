import { Box, Button, Card, CardContent, Stack, Tab, Tabs, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDashboardNational, usePhases, useTaskTemplates, useTasks, useMe } from '../api/hooks';
import { useDebounce } from '../app/useDebounce';
import { FiltersBar } from '../components/filters/FiltersBar';
import { SkeletonState } from '../components/states/SkeletonState';
import { ErrorState } from '../components/states/ErrorState';
import { EmptyState } from '../components/states/EmptyState';
import { StatusChip } from '../components/chips/StatusChip';
import { DueBadge } from '../components/chips/DueBadge';
import { ProgressInline } from '../components/chips/ProgressInline';
import { TaskDetailsDrawer } from '../components/tasks/TaskDetailsDrawer';
import { api } from '../api/client';
import { can } from '../app/rbac';

export function TasksPage() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(0);
  const { data: me } = useMe();

  const search = params.get('q') ?? '';
  const debouncedSearch = useDebounce(search, 300);

  const localityId = params.get('localityId') ?? '';
  const phaseId = params.get('phaseId') ?? '';
  const status = params.get('status') ?? '';
  const assigneeId = params.get('assigneeId') ?? '';
  const dueFrom = params.get('dueFrom') ?? '';
  const dueTo = params.get('dueTo') ?? '';

  const taskFilters = useMemo(
    () => ({
      localityId: localityId || undefined,
      phaseId: phaseId || undefined,
      status: status || undefined,
      assigneeId: assigneeId || undefined,
      dueFrom: dueFrom || undefined,
      dueTo: dueTo || undefined,
    }),
    [localityId, phaseId, status, assigneeId, dueFrom, dueTo],
  );

  const tasksQuery = useTasks(taskFilters);
  const phasesQuery = usePhases();
  const templatesQuery = useTaskTemplates();
  const dashboardQuery = useDashboardNational({});

  const templateMap = new Map((templatesQuery.data?.items ?? []).map((t: any) => [t.id, t]));
  const items = (tasksQuery.data?.items ?? []).map((task: any) => ({
    ...task,
    taskTemplate: templateMap.get(task.taskTemplateId),
  }));
  const filteredItems = debouncedSearch
    ? items.filter((item: any) => item.taskTemplate?.title?.toLowerCase().includes(debouncedSearch.toLowerCase()))
    : items;

  const localities = (dashboardQuery.data?.items ?? []).map((loc: any) => ({
    id: loc.localityId,
    name: loc.localityName,
  }));
  const localityMap = new Map(localities.map((loc) => [loc.id, loc.name]));

  const phases = (phasesQuery.data?.items ?? []).map((phase: any) => ({
    id: phase.id,
    name: phase.name,
  }));
  const phaseMap = new Map(phases.map((phase) => [phase.id, phase.name]));

  const assignees = me?.executive_hide_pii
    ? []
    : Array.from(
        new Map(
          filteredItems
            .filter((item: any) => item.assignedToId)
            .map((item: any) => [item.assignedToId, { id: item.assignedToId, name: `Usuario ${item.assignedToId}` }]),
        ).values(),
      );

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const selectedTask = filteredItems.find((item: any) => item.id === selectedTaskId) ?? null;

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  const clearFilters = () => {
    setParams({});
  };

  if (tasksQuery.isLoading) {
    return <SkeletonState />;
  }

  if (tasksQuery.isError) {
    return <ErrorState error={tasksQuery.error} onRetry={() => tasksQuery.refetch()} />;
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4">Tarefas</Typography>
        {can(me, 'task_instances', 'export') && (
          <Button
            variant="outlined"
            onClick={() => {
              const query = new URLSearchParams(taskFilters as any).toString();
              const base = api.defaults.baseURL ?? '';
              window.open(`${base}/exports/tasks.csv?${query}`, '_blank');
            }}
          >
            Exportar CSV
          </Button>
        )}
      </Stack>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <FiltersBar
            search={search}
            onSearchChange={(value) => updateParam('q', value)}
            localityId={localityId}
            onLocalityChange={(value) => updateParam('localityId', value)}
            phaseId={phaseId}
            onPhaseChange={(value) => updateParam('phaseId', value)}
            status={status}
            onStatusChange={(value) => updateParam('status', value)}
            assigneeId={assigneeId}
            onAssigneeChange={(value) => updateParam('assigneeId', value)}
            dueFrom={dueFrom}
            dueTo={dueTo}
            onDueFromChange={(value) => updateParam('dueFrom', value)}
            onDueToChange={(value) => updateParam('dueTo', value)}
            localities={localities}
            phases={phases}
            assignees={assignees}
            onClear={clearFilters}
          />
        </CardContent>
      </Card>

      <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mb: 2 }}>
        <Tab label="Tabela" />
        <Tab label="Kanban" />
      </Tabs>

      {filteredItems.length === 0 && (
        <EmptyState
          title="Nenhuma tarefa encontrada"
          description="Ajuste os filtros ou tente uma nova busca."
        />
      )}

      {filteredItems.length > 0 && tab === 0 && (
        <Card>
          <CardContent>
            <Box component="table" width="100%" sx={{ borderCollapse: 'collapse' }}>
              <Box component="thead">
                <Box component="tr">
                  {['Titulo', 'Localidade', 'Fase', 'Prazo', 'Responsavel', 'Status', 'Progresso', 'Acoes'].map(
                    (header) => (
                      <Box key={header} component="th" sx={{ textAlign: 'left', pb: 1, fontWeight: 600 }}>
                        {header}
                      </Box>
                    ),
                  )}
                </Box>
              </Box>
              <Box component="tbody">
                {filteredItems.map((task: any, index: number) => (
                  <Box
                    component="tr"
                    key={task.id}
                    sx={{ cursor: 'pointer', borderTop: '1px solid #E6ECF5' }}
                    onClick={() => setSelectedTaskId(task.id)}
                    data-testid={`tasks-table-row-${index}`}
                  >
                    <Box component="td" sx={{ py: 1 }}>{task.taskTemplate?.title ?? '-'}</Box>
                    <Box component="td" sx={{ py: 1 }}>{localityMap.get(task.localityId) ?? task.localityId ?? '-'}</Box>
                    <Box component="td" sx={{ py: 1 }}>{phaseMap.get(task.taskTemplate?.phaseId) ?? '-'}</Box>
                    <Box component="td" sx={{ py: 1 }}><DueBadge dueDate={task.dueDate} /></Box>
                    <Box component="td" sx={{ py: 1 }}>
                      {me?.executive_hide_pii ? '-' : task.assignedToId ?? '-'}
                    </Box>
                    <Box component="td" sx={{ py: 1 }}>
                      <StatusChip status={task.status} isLate={task.isLate} blocked={task.blockedByIds?.length > 0} />
                    </Box>
                    <Box component="td" sx={{ py: 1 }}>
                      <ProgressInline value={task.progressPercent ?? 0} />
                    </Box>
                    <Box component="td" sx={{ py: 1 }}>Abrir</Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {filteredItems.length > 0 && tab === 1 && (
        <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: 'repeat(5, 1fr)' }} gap={2}>
          {['NOT_STARTED', 'STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE'].map((column) => (
            <Card key={column}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {column}
                </Typography>
                <Box display="grid" gap={1}>
                  {filteredItems
                    .filter((task: any) => task.status === column)
                    .map((task: any) => (
                      <Card
                        key={task.id}
                        variant="outlined"
                        sx={{ cursor: 'pointer' }}
                        onClick={() => setSelectedTaskId(task.id)}
                      >
                        <CardContent>
                          <Typography variant="subtitle2">{task.taskTemplate?.title ?? '-'}</Typography>
                          <DueBadge dueDate={task.dueDate} />
                        </CardContent>
                      </Card>
                    ))}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
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
