import { Box, Button, Card, CardContent, Link, MenuItem, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import { format } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { useLocalities, useEloRoles, usePhases, useTaskTemplates, useTasks, useMe, useBatchAssignTasks, useBatchStatusTasks, useUsers } from '../api/hooks';
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
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridRowSelectionModel } from '@mui/x-data-grid';
import { ptBR as dataGridPtBR } from '@mui/x-data-grid/locales';
import { useToast } from '../app/toast';
import { parseApiError } from '../app/apiErrors';
import { TASK_STATUS_LABELS } from '../constants/enums';

function resolveTaskTitle(task: any) {
  const raw =
    task?.taskTemplate?.title ??
    task?.title ??
    task?.taskTitle ??
    '';
  const normalized = String(raw).trim();
  return normalized || 'Tarefa sem título';
}

function resolveTaskLocalityName(task: any, localityMap: Map<string, string>) {
  const fromTask = String(task?.localityName ?? task?.locality?.name ?? '').trim();
  if (fromTask) return fromTask;

  const mapped = localityMap.get(String(task?.localityId ?? ''));
  if (mapped && mapped.trim()) return mapped.trim();

  const fromCode = String(task?.localityCode ?? task?.locality?.code ?? '').trim();
  if (fromCode) return fromCode;

  return '-';
}

export function TasksPage() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(0);
  const { data: me } = useMe();
  const toast = useToast();

  const search = params.get('q') ?? '';
  const debouncedSearch = useDebounce(search, 300);

  const localityId = params.get('localityId') ?? '';
  const phaseId = params.get('phaseId') ?? '';
  const status = params.get('status') ?? '';
  const assigneeIdsParam = params.get('assigneeIds') ?? params.get('assigneeId') ?? '';
  const assigneeIds = assigneeIdsParam
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const assigneeIdsFilter = assigneeIds.join(',');
  const dueFrom = params.get('dueFrom') ?? '';
  const dueTo = params.get('dueTo') ?? '';
  const eloRoleId = params.get('eloRoleId') ?? '';

  const taskFilters = useMemo(
    () => ({
      localityId: localityId || undefined,
      phaseId: phaseId || undefined,
      status: status || undefined,
      assigneeIds: assigneeIdsFilter || undefined,
      dueFrom: dueFrom || undefined,
      dueTo: dueTo || undefined,
      eloRoleId: eloRoleId || undefined,
    }),
    [localityId, phaseId, status, assigneeIdsFilter, dueFrom, dueTo, eloRoleId],
  );

  const tasksQuery = useTasks(taskFilters);
  const canViewUsers = can(me, 'users', 'view');
  const usersQuery = useUsers(canViewUsers);
  const phasesQuery = usePhases();
  const eloRolesQuery = useEloRoles();
  const eloRoles = eloRolesQuery.data?.items ?? [];
  const templatesQuery = useTaskTemplates();
  const localitiesQuery = useLocalities();

  const templateMap = new Map((templatesQuery.data?.items ?? []).map((t: any) => [t.id, t]));
  const items = (tasksQuery.data?.items ?? []).map((task: any) => ({
    ...task,
    taskTemplate: task.taskTemplate ?? templateMap.get(task.taskTemplateId) ?? null,
  }));
  const filteredItems = debouncedSearch
    ? items.filter((item: any) => resolveTaskTitle(item).toLowerCase().includes(debouncedSearch.toLowerCase()))
    : items;

  const localitiesData = (localitiesQuery.data?.items ?? []) as any[];
  const localities = localitiesData.length > 0
    ? localitiesData.map((loc: any) => ({
        id: String(loc.id),
        name: String(loc.name ?? loc.code ?? loc.id),
      }))
    : Array.from(
        new Map<string, { id: string; name: string }>(
          items.map((task: any) => [
            String(task.localityId),
            {
              id: String(task.localityId),
              name: resolveTaskLocalityName(task, new Map()),
            },
          ]),
        ).values(),
      );
  const localityMap = new Map(localities.map((loc) => [loc.id, loc.name]));

  const phases = ((phasesQuery.data?.items ?? []) as any[]).map((phase: any) => ({
    id: phase.id,
    name: phase.name,
  }));
  const phaseMap = new Map(phases.map((phase) => [phase.id, phase.name]));

  const assignees: { id: string; name: string }[] = me?.executive_hide_pii
    ? []
    : (usersQuery.data?.items ?? []).length > 0
      ? (usersQuery.data?.items ?? [])
          .map((user: any) => ({
            id: String(user.id),
            name: user.name ?? user.email ?? `Usuário ${String(user.id).slice(0, 8)}`,
          }))
          .sort(
            (a: { id: string; name: string }, b: { id: string; name: string }) =>
              a.name.localeCompare(b.name, 'pt-BR'),
          )
      : Array.from(
          new Map<string, { id: string; name: string }>(
            items
              .filter((item: any) => item.assignedToId)
              .map((item: any) => [
                String(item.assignedToId),
                {
                  id: String(item.assignedToId),
                  name:
                    item.assignee?.name ??
                    item.assignedTo?.name ??
                    item.assignedTo?.email ??
                    `Usuário ${String(item.assignedToId).slice(0, 8)}`,
                },
              ]),
          ).values(),
        );

  const taskIdFromUrl = params.get('taskId') ?? '';
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(taskIdFromUrl || null);
  const selectedTask = filteredItems.find((item: any) => item.id === selectedTaskId) ?? null;

  useEffect(() => {
    if (taskIdFromUrl && taskIdFromUrl !== selectedTaskId) setSelectedTaskId(taskIdFromUrl);
  }, [taskIdFromUrl, selectedTaskId]);
  const [selectionModel, setSelectionModel] = useState<GridRowSelectionModel>(() => ({ type: 'include', ids: new Set() }));
  const selectedIds = selectionModel?.type === 'include' && selectionModel?.ids ? Array.from(selectionModel.ids) : [];
  const safeRows = Array.isArray(filteredItems) ? filteredItems.filter((r: any) => r != null && r.id != null) : [];
  const [batchAssignee, setBatchAssignee] = useState('');
  const [batchStatus, setBatchStatus] = useState('');
  const batchAssign = useBatchAssignTasks();
  const batchStatusMutation = useBatchStatusTasks();

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  const updateAssigneeIds = (values: string[]) => {
    const next = new URLSearchParams(params);
    if (values.length > 0) next.set('assigneeIds', values.join(','));
    else next.delete('assigneeIds');
    next.delete('assigneeId');
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
            assigneeId={assigneeIds[0] ?? ''}
            onAssigneeChange={(value) => updateAssigneeIds(value ? [value] : [])}
            dueFrom={dueFrom}
            dueTo={dueTo}
            onDueFromChange={(value) => updateParam('dueFrom', value)}
            onDueToChange={(value) => updateParam('dueTo', value)}
            eloRoleId={eloRoleId}
            onEloRoleChange={(value) => updateParam('eloRoleId', value)}
            localities={localities}
            phases={phases}
            eloRoles={eloRoles}
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
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} mb={2} alignItems="center">
              <Typography variant="subtitle2">
                Selecionadas: {selectedIds.length}
              </Typography>
              {can(me, 'task_instances', 'assign') && (
                <TextField
                  select
                  size="small"
                  label="Responsável"
                  value={batchAssignee}
                  onChange={(e) => setBatchAssignee(e.target.value)}
                  sx={{ minWidth: 260 }}
                >
                  <MenuItem value="">Selecionar</MenuItem>
                  <MenuItem value="__UNASSIGNED__">Sem responsável</MenuItem>
                  {assignees.map((assignee) => (
                    <MenuItem key={assignee.id} value={assignee.id}>
                      {assignee.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}
              {can(me, 'task_instances', 'update') && (
                <TextField
                  select
                  size="small"
                  label="Status"
                  value={batchStatus}
                  onChange={(e) => setBatchStatus(e.target.value)}
                  sx={{ minWidth: 160 }}
                >
                  <MenuItem value="">-</MenuItem>
                  {['NOT_STARTED', 'STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE'].map((s) => (
                    <MenuItem key={s} value={s}>
                      {TASK_STATUS_LABELS[s] ?? s}
                    </MenuItem>
                  ))}
                </TextField>
              )}
              <Button
                variant="outlined"
                disabled={
                  !selectedIds.length ||
                  !batchAssignee ||
                  !can(me, 'task_instances', 'assign')
                }
                onClick={async () => {
                  try {
                    await batchAssign.mutateAsync({
                      ids: selectedIds.map(String),
                      assignedToId:
                        batchAssignee === '__UNASSIGNED__' ? null : batchAssignee,
                    });
                    toast.push({ message: 'Responsável atualizado', severity: 'success' });
                  } catch (error) {
                    const payload = parseApiError(error);
                    toast.push({ message: payload.message ?? 'Erro ao atribuir', severity: 'error' });
                  }
                }}
              >
                Atribuir em massa
              </Button>
              <Button
                variant="outlined"
                disabled={!selectedIds.length || !batchStatus || !can(me, 'task_instances', 'update')}
                onClick={async () => {
                  try {
                    await batchStatusMutation.mutateAsync({ ids: selectedIds.map(String), status: batchStatus });
                    toast.push({ message: 'Status atualizado', severity: 'success' });
                  } catch (error) {
                    const payload = parseApiError(error);
                    toast.push({ message: payload.message ?? 'Erro ao atualizar', severity: 'error' });
                  }
                }}
              >
                Status em massa
              </Button>
            </Stack>
            <Box sx={{ height: 520 }}>
              <DataGrid
                rows={safeRows}
                getRowId={(row) => String(row.id)}
                localeText={dataGridPtBR.components.MuiDataGrid.defaultProps.localeText}
                columns={[
                  {
                    field: 'title',
                    headerName: 'Título da tarefa',
                    flex: 1.4,
                    minWidth: 360,
                    valueGetter: (_, row) => resolveTaskTitle(row),
                  },
                  {
                    field: 'locality',
                    headerName: 'Localidade',
                    width: 145,
                    valueGetter: (_, row) => resolveTaskLocalityName(row, localityMap),
                  },
                  {
                    field: 'phase',
                    headerName: 'Fase',
                    width: 130,
                    valueGetter: (_, row) => phaseMap.get(row.taskTemplate?.phaseId) ?? '-',
                  },
                  {
                    field: 'specialty',
                    headerName: 'Especialidade',
                    width: 160,
                    valueGetter: (_, row) => row.specialtyName ?? 'Todas',
                  },
                  {
                    field: 'dueDate',
                    headerName: 'Prazo',
                    width: 125,
                    renderCell: (params) => <DueBadge dueDate={params.row.dueDate} status={params.row.status} />,
                  },
                  {
                    field: 'assignee',
                    headerName: 'Responsável',
                    width: 170,
                    valueGetter: (_, row) =>
                      me?.executive_hide_pii
                        ? '-'
                        : row.assignee?.label ??
                          row.assignee?.name ??
                          row.assignedTo?.name ??
                          row.assignedTo?.email ??
                          '-',
                  },
                  {
                    field: 'comments',
                    headerName: 'Comentários',
                    width: 120,
                    renderCell: (params) => {
                      const total = params.row.comments?.total ?? 0;
                      const unread = params.row.comments?.unread ?? 0;
                      if (!total) return '—';
                      return unread > 0 ? `Novo (${unread})` : `${total}`;
                    },
                  },
                  {
                    field: 'status',
                    headerName: 'Status',
                    width: 130,
                    renderCell: (params) => (
                      <StatusChip
                        status={params.row.status}
                        isLate={params.row.isLate}
                        blocked={params.row.blockedByIds?.length > 0}
                      />
                    ),
                  },
                  {
                    field: 'progress',
                    headerName: 'Progresso',
                    width: 145,
                    renderCell: (params) => <ProgressInline value={params.row.progressPercent ?? 0} />,
                  },
                  {
                    field: 'eloRole',
                    headerName: 'Elo',
                    width: 100,
                    valueGetter: (_, row) => row.eloRole?.name ?? row.eloRole?.code ?? '—',
                  },
                  {
                    field: 'meeting',
                    headerName: 'Reunião',
                    width: 170,
                    renderCell: (params) => {
                      const m = params.row.meeting;
                      if (!m) return '—';
                      return (
                        <Link component={RouterLink} to={`/meetings?meetingId=${m.id}`} sx={{ fontSize: 13 }}>
                          {format(new Date(m.datetime), 'dd/MM/yyyy')} — {m.scope ? (m.scope.length > 15 ? m.scope.slice(0, 15) + '…' : m.scope) : 'Reunião'}
                        </Link>
                      );
                    },
                  },
                ] as GridColDef[]}
                checkboxSelection
                rowSelectionModel={selectionModel}
                onRowSelectionModelChange={(newModel) => {
                  if (newModel && typeof newModel === 'object' && 'type' in newModel && 'ids' in newModel && newModel.ids instanceof Set) {
                    setSelectionModel(newModel as GridRowSelectionModel);
                  }
                }}
                onRowClick={(params) => setSelectedTaskId(params.row.id)}
                disableRowSelectionOnClick
              />
            </Box>
          </CardContent>
        </Card>
      )}

      {filteredItems.length > 0 && tab === 1 && (
        <Box
          display="grid"
          gridTemplateColumns={{
            xs: '1fr',
            md: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(3, minmax(0, 1fr))',
            xl: 'repeat(5, minmax(0, 1fr))',
          }}
          gap={2}
        >
          {['NOT_STARTED', 'STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE'].map((column) => (
            <Card key={column}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {TASK_STATUS_LABELS[column] ?? column}
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
                          <Typography variant="subtitle2">{resolveTaskTitle(task)}</Typography>
                          <DueBadge dueDate={task.dueDate} status={task.status} />
                          {(task.comments?.unread ?? 0) > 0 && (
                            <Typography variant="caption" color="warning.main" display="block" sx={{ mt: 0.4 }}>
                              Novo comentário ({task.comments.unread})
                            </Typography>
                          )}
                          {task.eloRole && (
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                              Elo: {task.eloRole.name ?? task.eloRole.code}
                            </Typography>
                          )}
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                            Especialidade: {task.specialtyName ?? 'Todas'}
                          </Typography>
                          {task.meeting && (
                            <Link component={RouterLink} to={`/meetings?meetingId=${task.meeting.id}`} onClick={(e) => e.stopPropagation()} sx={{ fontSize: 11, mt: 0.5, display: 'block' }}>
                              Reunião: {format(new Date(task.meeting.datetime), 'dd/MM')}
                            </Link>
                          )}
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
        onDeleted={() => setSelectedTaskId(null)}
        user={me}
        localities={localities}
      />
    </Box>
  );
}
