import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Drawer,
  FormControlLabel,
  Link,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { addDays, format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import {
  useCipavdLocalities,
  useLocalities,
  useEloRoles,
  usePhases,
  useTaskTemplates,
  useTasks,
  useTaskInstance,
  useMe,
  useBatchAssignTasks,
  useBatchDeleteTasks,
  useBatchStatusTasks,
  useUsers,
  useGenerateInstances,
  useCreateTaskInstance,
  useTaskAssignableUsers,
  useTaskAssigneesMulti,
} from "../api/hooks";
import { useDebounce } from "../app/useDebounce";
import { FiltersBar } from "../components/filters/FiltersBar";
import { SkeletonState } from "../components/states/SkeletonState";
import { ErrorState } from "../components/states/ErrorState";
import { EmptyState } from "../components/states/EmptyState";
import { StatusChip } from "../components/chips/StatusChip";
import { DueBadge } from "../components/chips/DueBadge";
import { TaskDetailsDrawer } from "../components/tasks/TaskDetailsDrawer";
import { api } from "../api/client";
import { can } from "../app/rbac";
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef, GridRowSelectionModel } from "@mui/x-data-grid";
import { ptBR as dataGridPtBR } from "@mui/x-data-grid/locales";
import { useToast } from "../app/toast";
import { parseApiError } from "../app/apiErrors";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "../constants/enums";
import { ConfirmDialog } from "../components/dialogs/ConfirmDialog";
import {
  clampTasksPage,
  resolveTasksPage,
  resolveTasksPageSize,
  TASKS_PAGE_SIZE_OPTIONS,
  writeTasksPaginationParams,
} from "../features/tasksPagination";

function resolveTaskTitle(task: any) {
  const raw =
    task?.title ??
    task?.titleOverride ??
    task?.taskTemplate?.title ??
    task?.taskTitle ??
    "";
  const normalized = String(raw).trim();
  return normalized || "Tarefa sem título";
}

const APP_HEADER_HEIGHT = 96;
type TaskScope = "SMIF" | "CIPAVD";

function resolveTaskLocalityName(task: any, localityMap: Map<string, string>) {
  const fromTask = String(
    task?.localityName ?? task?.locality?.name ?? "",
  ).trim();
  if (fromTask) return fromTask;

  const mapped = localityMap.get(String(task?.localityId ?? ""));
  if (mapped && mapped.trim()) return mapped.trim();

  const fromCode = String(
    task?.localityCode ?? task?.locality?.code ?? "",
  ).trim();
  if (fromCode) return fromCode;

  return "-";
}

export function TasksPage() {
  const [params, setParams] = useSearchParams();
  const [viewTab, setViewTab] = useState(0);
  const { data: me } = useMe();
  const toast = useToast();
  const defaultBaseDate = format(new Date(), "yyyy-MM-dd");

  const search = params.get("q") ?? "";
  const debouncedSearch = useDebounce(search, 300);
  const taskScope: TaskScope =
    params.get("scope") === "CIPAVD" ? "CIPAVD" : "SMIF";

  const localityId = params.get("localityId") ?? "";
  const phaseId = params.get("phaseId") ?? "";
  const status = params.get("status") ?? "";
  const page = resolveTasksPage(params.get("page"));
  const pageSize = resolveTasksPageSize(params.get("pageSize"));
  const assigneeIdsParam =
    params.get("assigneeIds") ?? params.get("assigneeId") ?? "";
  const assigneeIds = assigneeIdsParam
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const assigneeIdsFilter = assigneeIds.join(",");
  const dueFrom = params.get("dueFrom") ?? "";
  const dueTo = params.get("dueTo") ?? "";
  const eloRoleId = params.get("eloRoleId") ?? "";

  const taskFilters = useMemo(
    () => ({
      scope: taskScope,
      localityId: localityId || undefined,
      phaseId: phaseId || undefined,
      status: status || undefined,
      assigneeIds: assigneeIdsFilter || undefined,
      dueFrom: dueFrom || undefined,
      dueTo: dueTo || undefined,
      eloRoleId: eloRoleId || undefined,
    }),
    [
      taskScope,
      localityId,
      phaseId,
      status,
      assigneeIdsFilter,
      dueFrom,
      dueTo,
      eloRoleId,
    ],
  );

  const tasksQuery = useTasks({
    ...taskFilters,
    page: "1",
    pageSize: "all",
  });
  const canManageTaskAssignments = can(me, "task_instances", "assign");
  const canManageTaskData = can(me, "task_instances", "update");
  const canCreateTask = can(me, "task_instances", "create");
  const canGenerateTaskInstances = can(me, "task_templates", "create");
  const canViewUsers = can(me, "users", "view");
  const usersQuery = useUsers(canViewUsers);
  const phasesQuery = usePhases();
  const eloRolesQuery = useEloRoles();
  const eloRoles = eloRolesQuery.data?.items ?? [];
  const templatesQuery = useTaskTemplates();
  const localitiesQuery = useLocalities();
  const cipavdLocalitiesQuery = useCipavdLocalities();

  const templateMap = new Map(
    (templatesQuery.data?.items ?? []).map((t: any) => [t.id, t]),
  );
  const items = (tasksQuery.data?.items ?? []).map((task: any) => ({
    ...task,
    taskTemplate:
      task.taskTemplate ?? templateMap.get(task.taskTemplateId) ?? null,
  }));
  const filteredItems = debouncedSearch
    ? items.filter((item: any) =>
        resolveTaskTitle(item)
          .toLowerCase()
          .includes(debouncedSearch.toLowerCase()),
      )
    : items;

  const smifLocalitiesData = (localitiesQuery.data?.items ?? []) as any[];
  const cipavdLocalitiesData = (cipavdLocalitiesQuery.data?.items ??
    []) as any[];
  const mapCatalogLocalities = (rows: any[]) =>
    rows
      .map((loc: any) => ({
        id: String(loc.id),
        name: String(loc.name ?? loc.code ?? loc.id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const smifLocalities = useMemo(
    () => mapCatalogLocalities(smifLocalitiesData),
    [smifLocalitiesData],
  );
  const cipavdLocalities = useMemo(
    () => mapCatalogLocalities(cipavdLocalitiesData),
    [cipavdLocalitiesData],
  );
  const localities = taskScope === "CIPAVD" ? cipavdLocalities : smifLocalities;

  const localityMap = useMemo(
    () => new Map(localities.map((loc) => [loc.id, loc.name])),
    [localities],
  );

  const phases = ((phasesQuery.data?.items ?? []) as any[]).map(
    (phase: any) => ({
      id: phase.id,
      name: phase.name,
    }),
  );
  const phaseMap = new Map(phases.map((phase) => [phase.id, phase.name]));

  const directoryUsers = useMemo(() => {
    if (me?.executive_hide_pii || !canViewUsers) return [];
    return ((usersQuery.data?.items ?? []) as any[])
      .map((user: any) => ({
        id: String(user.id),
        localityId:
          user?.localityId === undefined || user?.localityId === null
            ? null
            : String(user.localityId),
        name:
          user.name ?? user.email ?? `Usuário ${String(user.id).slice(0, 8)}`,
      }))
      .sort(
        (a: { id: string; name: string }, b: { id: string; name: string }) =>
          a.name.localeCompare(b.name, "pt-BR"),
      );
  }, [canViewUsers, me?.executive_hide_pii, usersQuery.data?.items]);

  const assignees: { id: string; name: string; localityId?: string | null }[] =
    directoryUsers.length > 0
      ? directoryUsers
      : me?.executive_hide_pii
        ? []
        : Array.from(
            new Map<
              string,
              { id: string; name: string; localityId?: string | null }
            >(
              items
                .filter((item: any) => item.assignedToId)
                .map((item: any) => [
                  String(item.assignedToId),
                  {
                    id: String(item.assignedToId),
                    localityId:
                      item?.localityId === undefined ||
                      item?.localityId === null
                        ? null
                        : String(item.localityId),
                    name:
                      item.assignee?.name ??
                      item.assignedTo?.name ??
                      item.assignedTo?.email ??
                      `Usuário ${String(item.assignedToId).slice(0, 8)}`,
                  },
                ]),
            ).values(),
          );

  const taskIdFromUrl = params.get("taskId") ?? "";
  const selectedTaskQuery = useTaskInstance(
    taskIdFromUrl,
    Boolean(taskIdFromUrl),
  );
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    taskIdFromUrl || null,
  );
  const groupedRows = useMemo(() => {
    const groups = new Map<string, any[]>();
    for (const task of filteredItems) {
      const explicitGroupKey = String(task.groupKey ?? "").trim();
      const createdDateKey =
        String(task.createdAt ?? "").slice(0, 10) ||
        String(task.dueDate ?? "").slice(0, 10);
      const phaseKey = String(task.taskTemplate?.phaseId ?? "");
      const templateKey = String(
        task.taskTemplateId ?? task.taskTemplate?.id ?? "",
      );
      const meetingKey = String(task.meetingId ?? "");
      const specialtyKey = String(task.specialtyId ?? "");
      const eloRoleKey = String(task.eloRoleId ?? "");
      const scopeKey = String(task.scope ?? "SMIF").trim();
      const titleKey = resolveTaskTitle(task).trim().toLowerCase();
      const fallbackLegacyKey = `legacy:${scopeKey}|${templateKey}|${titleKey}|${phaseKey}|${createdDateKey}|${meetingKey}|${specialtyKey}|${eloRoleKey}`;
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
      if (
        key.startsWith("legacy:") &&
        uniqueLocalities.length <= 1 &&
        group.length <= 1
      ) {
        group.forEach((task: any) => {
          rows.push({
            ...task,
            id: String(task.id),
            primaryTaskId: String(task.id),
            groupedTaskIds: [String(task.id)],
            groupedLocalities: [
              {
                id: String(task.localityId),
                name: resolveTaskLocalityName(task, localityMap),
              },
            ],
            groupedLocalityCount: 1,
            localityName: resolveTaskLocalityName(task, localityMap),
          });
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
        name: resolveTaskLocalityName(item, localityMap),
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
        id: `group:${key}`,
        primaryTaskId: String(primary.id),
        groupedTaskIds: taskIds,
        groupedLocalities,
        groupedLocalityCount: groupedLocalities.length,
        localityName:
          groupedLocalities.length > 1
            ? `${groupedLocalities.length} localidades`
            : (groupedLocalities[0]?.name ?? "-"),
        status: hasMixedStatus ? "IN_PROGRESS" : primary.status,
        progressPercent: hasMixedStatus
          ? averageProgress
          : Number(primary.progressPercent ?? 0),
      });
    }
    return rows;
  }, [filteredItems, localityMap]);

  const taskById = useMemo(
    () => new Map(items.map((item: any) => [String(item.id), item])),
    [items],
  );

  /** Qualquer id de instância do grupo aponta para a linha agregada (evita drawer sem localidades vinculadas). */
  const rowByAnyGroupedTaskId = useMemo(() => {
    const m = new Map<string, any>();
    for (const row of groupedRows) {
      const ids = (
        row.groupedTaskIds?.length
          ? row.groupedTaskIds
          : [String(row.primaryTaskId ?? row.id)]
      ) as string[];
      for (const id of ids) {
        m.set(String(id), row);
      }
    }
    return m;
  }, [groupedRows]);

  const selectedTask = selectedTaskId
    ? (taskById.get(String(selectedTaskId)) ??
      (taskIdFromUrl === selectedTaskId
        ? (selectedTaskQuery.data ?? null)
        : null))
    : null;
  const selectedTaskGroup = selectedTaskId
    ? (rowByAnyGroupedTaskId.get(String(selectedTaskId)) ?? null)
    : null;

  useEffect(() => {
    if (taskIdFromUrl && taskIdFromUrl !== selectedTaskId)
      setSelectedTaskId(taskIdFromUrl);
  }, [taskIdFromUrl, selectedTaskId]);
  useEffect(() => {
    const detail = selectedTaskQuery.data;
    if (!detail?.id) return;
    const detailScope = String(detail.scope ?? "SMIF").toUpperCase();
    if (detailScope === taskScope) return;
    const next = new URLSearchParams(params);
    next.set("scope", detailScope === "CIPAVD" ? "CIPAVD" : "SMIF");
    next.delete("localityId");
    setParams(next, { replace: true });
  }, [selectedTaskQuery.data, taskScope, params, setParams]);
  const [selectionModel, setSelectionModel] = useState<GridRowSelectionModel>(
    () => ({ type: "include", ids: new Set() }),
  );
  const safeRows = groupedRows.filter((r: any) => r != null && r.id != null);
  useEffect(() => {
    const nextPage = clampTasksPage(page, safeRows.length, pageSize);
    if (nextPage === page) return;
    setParams(writeTasksPaginationParams(params, nextPage, pageSize), {
      replace: true,
    });
  }, [page, pageSize, params, safeRows.length, setParams]);
  const rowTaskIdsMap = useMemo(
    () =>
      new Map(
        safeRows.map((row: any) => [
          String(row.id),
          (row.groupedTaskIds ?? [row.primaryTaskId ?? row.id]).map(String),
        ]),
      ),
    [safeRows],
  );
  const selectedIds = useMemo(() => {
    if (
      !selectionModel ||
      typeof selectionModel !== "object" ||
      !("type" in selectionModel) ||
      !("ids" in selectionModel)
    ) {
      return [];
    }

    const idsRaw = (selectionModel as any).ids;
    const ids =
      idsRaw instanceof Set
        ? Array.from(idsRaw).map(String)
        : Array.isArray(idsRaw)
          ? idsRaw.map(String)
          : [];

    const normalizeRowIds = (rowIds: string[]) => {
      const taskIds = rowIds.flatMap((rowId) => rowTaskIdsMap.get(rowId) ?? []);
      return Array.from(new Set(taskIds.map(String)));
    };

    if ((selectionModel as any).type === "include") {
      return normalizeRowIds(ids);
    }

    const excluded = new Set(ids);
    const rowIds = safeRows
      .map((row: any) => String(row.id))
      .filter((id) => !excluded.has(id));
    return normalizeRowIds(rowIds);
  }, [selectionModel, safeRows, rowTaskIdsMap]);
  const [batchAssignee, setBatchAssignee] = useState("");
  const [batchStatus, setBatchStatus] = useState("");
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const batchAssign = useBatchAssignTasks();
  const batchStatusMutation = useBatchStatusTasks();
  const batchDeleteMutation = useBatchDeleteTasks();
  const generateInstances = useGenerateInstances();
  const createTaskInstance = useCreateTaskInstance();

  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [createMode, setCreateMode] = useState<"template" | "manual">(
    "template",
  );
  const [createScope, setCreateScope] = useState<TaskScope>(taskScope);
  const [createTemplateId, setCreateTemplateId] = useState("");
  const [createManualTitle, setCreateManualTitle] = useState("");
  const [createManualDescription, setCreateManualDescription] = useState("");
  const [createManualPhaseId, setCreateManualPhaseId] = useState("");
  const [createBaseDate, setCreateBaseDate] = useState(defaultBaseDate);
  const [createPriority, setCreatePriority] = useState("MEDIUM");
  const [createLocalityIds, setCreateLocalityIds] = useState<string[]>([]);
  const [createOffsets, setCreateOffsets] = useState<Record<string, number>>(
    {},
  );
  const [createCustomOffsets, setCreateCustomOffsets] = useState(false);
  const [createAssignedToId, setCreateAssignedToId] = useState("");
  const [createAssigneeIds, setCreateAssigneeIds] = useState<string[]>([]);
  const createScopeLocalities =
    createScope === "CIPAVD" ? cipavdLocalities : smifLocalities;
  const createAssigneesQuery = useTaskAssigneesMulti(
    canManageTaskAssignments ? createLocalityIds : [],
  );
  const createAssignableUsersQuery = useTaskAssignableUsers(
    canManageTaskAssignments && !me?.executive_hide_pii,
  );

  const createAssigneeOptions = useMemo(() => {
    if (me?.executive_hide_pii) return [];
    const fromTaskAssignees = createAssigneesQuery.data?.items ?? [];
    const assignableUsers = (createAssignableUsersQuery.data?.items ??
      directoryUsers) as Array<{
      id?: string | null;
      name?: string | null;
    }>;

    const merged = new Map<string, { id: string; name: string }>();
    assignableUsers.forEach((item) => {
      const id = String(item?.id ?? "").trim();
      if (!id) return;
      merged.set(id, {
        id,
        name: String(item?.name ?? `Usuário ${id.slice(0, 8)}`),
      });
    });

    fromTaskAssignees.forEach((item: any) => {
      const id = String(item?.id ?? "").trim();
      if (!id) return;
      if (merged.has(id)) return;
      merged.set(id, {
        id,
        name: String(item?.name ?? item?.label ?? `Usuário ${id.slice(0, 8)}`),
      });
    });

    return Array.from(merged.values()).sort((a, b) =>
      String(a.name).localeCompare(String(b.name), "pt-BR"),
    );
  }, [
    createAssigneesQuery.data?.items,
    createAssignableUsersQuery.data?.items,
    directoryUsers,
    me?.executive_hide_pii,
  ]);

  const resetCreateForm = () => {
    setCreateMode("template");
    setCreateScope(taskScope);
    setCreateTemplateId("");
    setCreateManualTitle("");
    setCreateManualDescription("");
    setCreateManualPhaseId("");
    setCreateBaseDate(defaultBaseDate);
    setCreatePriority("MEDIUM");
    setCreateLocalityIds([]);
    setCreateOffsets({});
    setCreateCustomOffsets(false);
    setCreateAssignedToId("");
    setCreateAssigneeIds([]);
  };

  const openCreateDrawer = () => {
    resetCreateForm();
    setCreateDrawerOpen(true);
  };

  const selectedCreateLocalities = createScopeLocalities.filter((locality) =>
    createLocalityIds.includes(locality.id),
  );

  useEffect(() => {
    if (!createDrawerOpen) {
      setCreateScope(taskScope);
    }
  }, [taskScope, createDrawerOpen]);
  useEffect(() => {
    setCreateLocalityIds([]);
    setCreateOffsets({});
    setCreateAssignedToId("");
    setCreateAssigneeIds([]);
  }, [createScope]);

  const createTemplate = useMemo(
    () =>
      (templatesQuery.data?.items ?? []).find(
        (template: any) => template.id === createTemplateId,
      ) ?? null,
    [createTemplateId, templatesQuery.data?.items],
  );

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(writeTasksPaginationParams(next, 1, pageSize));
  };

  const updateAssigneeIds = (values: string[]) => {
    const next = new URLSearchParams(params);
    if (values.length > 0) next.set("assigneeIds", values.join(","));
    else next.delete("assigneeIds");
    next.delete("assigneeId");
    setParams(writeTasksPaginationParams(next, 1, pageSize));
  };

  const clearFilters = () => {
    setParams(
      writeTasksPaginationParams(
        new URLSearchParams({ scope: taskScope }),
        1,
        pageSize,
      ),
    );
  };

  const handleScopeTabChange = (_event: unknown, value: TaskScope) => {
    const next = new URLSearchParams(params);
    next.set("scope", value);
    next.delete("localityId");
    next.delete("taskId");
    setParams(writeTasksPaginationParams(next, 1, pageSize), {
      replace: true,
    });
    setSelectedTaskId(null);
    clearSelection();
  };

  const clearSelection = () => {
    setSelectionModel({ type: "include", ids: new Set() });
  };

  const handleBatchDelete = async () => {
    if (!selectedIds.length) return;
    try {
      await batchDeleteMutation.mutateAsync({ ids: selectedIds.map(String) });
      toast.push({
        message: `${selectedIds.length} tarefa(s) excluída(s).`,
        severity: "success",
      });
      if (selectedTaskId && selectedIds.includes(selectedTaskId)) {
        setSelectedTaskId(null);
      }
      clearSelection();
      setBatchDeleteOpen(false);
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? "Erro ao excluir tarefas selecionadas.",
        severity: "error",
      });
    }
  };

  const handleCreateTasks = async () => {
    if (!canCreateTask) return;
    if (!createBaseDate) {
      toast.push({
        message: "Informe a data base de prazo.",
        severity: "warning",
      });
      return;
    }
    if (!createLocalityIds.length) {
      toast.push({
        message: "Selecione ao menos uma localidade.",
        severity: "warning",
      });
      return;
    }

    const base = new Date(`${createBaseDate}T00:00:00`);
    if (Number.isNaN(base.getTime())) {
      toast.push({ message: "Data base inválida.", severity: "warning" });
      return;
    }

    try {
      let response: any = null;
      if (createMode === "template") {
        if (!canGenerateTaskInstances) {
          toast.push({
            message: "Sem permissão para gerar tarefas por modelo.",
            severity: "warning",
          });
          return;
        }
        if (!createTemplateId) {
          toast.push({
            message: "Selecione o modelo da tarefa.",
            severity: "warning",
          });
          return;
        }
        response = await generateInstances.mutateAsync({
          id: createTemplateId,
          payload: {
            scope: createScope,
            localities: createLocalityIds.map((id) => ({
              localityId: id,
              dueDate: addDays(
                base,
                createCustomOffsets ? (createOffsets[id] ?? 0) : 0,
              ).toISOString(),
            })),
            priority: createPriority,
            assignedToId: createAssignedToId || null,
            assigneeIds: createAssigneeIds,
          },
        });
      } else {
        if (!createManualTitle.trim()) {
          toast.push({
            message: "Informe o título da tarefa manual.",
            severity: "warning",
          });
          return;
        }
        if (!createManualPhaseId) {
          toast.push({
            message: "Selecione a fase da tarefa manual.",
            severity: "warning",
          });
          return;
        }
        response = await createTaskInstance.mutateAsync({
          scope: createScope,
          title: createManualTitle.trim(),
          description: createManualDescription.trim() || null,
          phaseId: createManualPhaseId,
          dueDate: base.toISOString(),
          priority: createPriority,
          localityIds: createLocalityIds,
          assignedToId: createAssignedToId || null,
          assigneeIds: createAssigneeIds,
        });
      }

      const firstCreatedId = response?.items?.[0]?.id;
      if (firstCreatedId) setSelectedTaskId(String(firstCreatedId));
      setCreateDrawerOpen(false);
      resetCreateForm();
      toast.push({
        message:
          createMode === "manual"
            ? "Tarefa criada com sucesso."
            : `${createLocalityIds.length} tarefa(s) criada(s) com sucesso.`,
        severity: "success",
      });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? "Erro ao criar tarefas.",
        severity: "error",
      });
    }
  };

  if (tasksQuery.isLoading) {
    return <SkeletonState />;
  }

  if (tasksQuery.isError) {
    return (
      <ErrorState
        error={tasksQuery.error}
        onRetry={() => tasksQuery.refetch()}
      />
    );
  }

  const scopeSubtitle =
    taskScope === "CIPAVD"
      ? "Tarefas operacionais vinculadas ao catálogo CIPAVD, com localidades próprias e gestão separada do fluxo SMIF."
      : "Tarefas operacionais do escopo SMIF, com localidades e acompanhamento independentes do fluxo CIPAVD.";

  return (
    <Box>
      <Stack
        direction={{ xs: "column", lg: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", lg: "center" }}
        spacing={1.25}
        mb={2}
      >
        <Box>
          <Typography variant="h4">Tarefas</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {scopeSubtitle}
          </Typography>
        </Box>
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          flexWrap="wrap"
          justifyContent={{ xs: "flex-start", lg: "flex-end" }}
        >
          {canCreateTask && (
            <Button variant="contained" onClick={openCreateDrawer}>
              Nova tarefa
            </Button>
          )}
          {can(me, "task_instances", "export") && (
            <Button
              variant="outlined"
              onClick={() => {
                const query = new URLSearchParams(
                  taskFilters as any,
                ).toString();
                const base = api.defaults.baseURL ?? "";
                window.open(`${base}/exports/tasks.csv?${query}`, "_blank");
              }}
            >
              Exportar CSV
            </Button>
          )}
        </Stack>
      </Stack>
      <Tabs value={taskScope} onChange={handleScopeTabChange} sx={{ mb: 2 }}>
        <Tab value="SMIF" label="SMIF" />
        <Tab value="CIPAVD" label="CIPAVD" />
      </Tabs>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <FiltersBar
            search={search}
            onSearchChange={(value) => updateParam("q", value)}
            localityId={localityId}
            onLocalityChange={(value) => updateParam("localityId", value)}
            phaseId={phaseId}
            onPhaseChange={(value) => updateParam("phaseId", value)}
            status={status}
            onStatusChange={(value) => updateParam("status", value)}
            assigneeId={assigneeIds[0] ?? ""}
            onAssigneeChange={(value) =>
              updateAssigneeIds(value ? [value] : [])
            }
            dueFrom={dueFrom}
            dueTo={dueTo}
            onDueFromChange={(value) => updateParam("dueFrom", value)}
            onDueToChange={(value) => updateParam("dueTo", value)}
            eloRoleId={eloRoleId}
            onEloRoleChange={(value) => updateParam("eloRoleId", value)}
            localities={localities}
            phases={phases}
            eloRoles={eloRoles}
            assignees={assignees}
            desktopColumns={4}
            onClear={clearFilters}
          />
        </CardContent>
      </Card>

      <Tabs
        value={viewTab}
        onChange={(_, value) => setViewTab(value)}
        sx={{ mb: 2 }}
      >
        <Tab label="Tabela" />
        <Tab label="Kanban" />
      </Tabs>

      {groupedRows.length === 0 && (
        <EmptyState
          title="Nenhuma tarefa encontrada"
          description="Ajuste os filtros ou tente uma nova busca."
        />
      )}

      {groupedRows.length > 0 && viewTab === 0 && (
        <Card sx={{ width: "100%" }}>
          <CardContent>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              mb={2}
              alignItems="center"
            >
              <Typography variant="subtitle2">
                Selecionadas: {selectedIds.length}
              </Typography>
              {canManageTaskAssignments && (
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
              {canManageTaskData && (
                <TextField
                  select
                  size="small"
                  label="Status"
                  value={batchStatus}
                  onChange={(e) => setBatchStatus(e.target.value)}
                  sx={{ minWidth: 160 }}
                >
                  <MenuItem value="">-</MenuItem>
                  {["NOT_STARTED", "STARTED", "IN_PROGRESS", "DONE"].map(
                    (s) => (
                      <MenuItem key={s} value={s}>
                        {TASK_STATUS_LABELS[s] ?? s}
                      </MenuItem>
                    ),
                  )}
                </TextField>
              )}
              <Button
                variant="outlined"
                disabled={
                  !selectedIds.length ||
                  !batchAssignee ||
                  !canManageTaskAssignments
                }
                onClick={async () => {
                  try {
                    await batchAssign.mutateAsync({
                      ids: selectedIds.map(String),
                      assignedToId:
                        batchAssignee === "__UNASSIGNED__"
                          ? null
                          : batchAssignee,
                    });
                    toast.push({
                      message: "Responsável atualizado",
                      severity: "success",
                    });
                  } catch (error) {
                    const payload = parseApiError(error);
                    toast.push({
                      message: payload.message ?? "Erro ao atribuir",
                      severity: "error",
                    });
                  }
                }}
              >
                Atribuir em massa
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="success"
                sx={{ minHeight: 32, px: 1.5 }}
                disabled={
                  !selectedIds.length || !batchStatus || !canManageTaskData
                }
                onClick={async () => {
                  try {
                    await batchStatusMutation.mutateAsync({
                      ids: selectedIds.map(String),
                      status: batchStatus,
                    });
                    toast.push({
                      message: "Status atualizado",
                      severity: "success",
                    });
                  } catch (error) {
                    const payload = parseApiError(error);
                    toast.push({
                      message: payload.message ?? "Erro ao atualizar",
                      severity: "error",
                    });
                  }
                }}
              >
                Status em massa
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                sx={{ minHeight: 32, px: 1.5 }}
                disabled={!selectedIds.length || !canManageTaskData}
                onClick={() => setBatchDeleteOpen(true)}
              >
                Excluir selecionadas
              </Button>
            </Stack>
            <Box sx={{ width: "100%" }}>
              <DataGrid
                rows={safeRows}
                getRowId={(row) => String(row.id)}
                autoHeight
                pagination
                paginationMode="client"
                pageSizeOptions={[...TASKS_PAGE_SIZE_OPTIONS]}
                paginationModel={{ page: page - 1, pageSize }}
                onPaginationModelChange={(model) => {
                  const nextPageSize = resolveTasksPageSize(
                    String(model.pageSize),
                  );
                  const nextPage =
                    nextPageSize !== pageSize ? 1 : Number(model.page ?? 0) + 1;
                  setParams(
                    writeTasksPaginationParams(params, nextPage, nextPageSize),
                    { replace: true },
                  );
                }}
                hideFooterSelectedRowCount
                localeText={
                  dataGridPtBR.components.MuiDataGrid.defaultProps.localeText
                }
                sx={{
                  width: "100%",
                  "--DataGrid-containerBackground": "rgb(23, 57, 75)",
                  "& .MuiDataGrid-columnHeaders": {
                    backgroundColor: "rgb(23, 57, 75) !important",
                    color: "#FFFFFF !important",
                  },
                  "& .MuiDataGrid-topContainer": {
                    backgroundColor: "rgb(23, 57, 75) !important",
                  },
                  "& .MuiDataGrid-columnHeaderRow": {
                    backgroundColor: "rgb(23, 57, 75) !important",
                  },
                  "& .MuiDataGrid-columnHeader": {
                    backgroundColor: "rgb(23, 57, 75) !important",
                    color: "#FFFFFF !important",
                  },
                  "& .MuiDataGrid-columnHeaderTitle": {
                    fontWeight: 700,
                    color: "#FFFFFF !important",
                  },
                  "& .MuiDataGrid-columnHeaderTitleContainer": {
                    color: "#FFFFFF !important",
                  },
                  "& .MuiDataGrid-columnHeaderDraggableContainer": {
                    color: "#FFFFFF !important",
                  },
                  "& .MuiDataGrid-sortIcon, & .MuiDataGrid-menuIconButton": {
                    color: "#FFFFFF !important",
                  },
                  "& .MuiDataGrid-menuIconButton .MuiSvgIcon-root, & .MuiDataGrid-sortIcon .MuiSvgIcon-root":
                    {
                      color: "#FFFFFF !important",
                    },
                  "& .MuiDataGrid-iconSeparator": {
                    color: "rgba(255,255,255,0.45)",
                  },
                  "& .MuiDataGrid-row": {
                    cursor: "pointer",
                  },
                  "& .MuiDataGrid-cellCheckbox": {
                    cursor: "default",
                  },
                  "& .MuiDataGrid-footerContainer": {
                    borderTop: "1px solid #E3EAF3",
                  },
                }}
                columns={
                  [
                    {
                      field: "title",
                      headerName: "Título da tarefa",
                      flex: 1.15,
                      minWidth: 280,
                      valueGetter: (_, row) => resolveTaskTitle(row),
                      renderCell: (params) => {
                        const title = resolveTaskTitle(params.row);
                        const commentsTotal = Number(
                          params.row.comments?.total ?? 0,
                        );
                        const unreadComments = Number(
                          params.row.comments?.unread ?? 0,
                        );
                        return (
                          <Stack
                            direction="row"
                            alignItems="center"
                            spacing={0.8}
                            sx={{ minWidth: 0, width: "100%" }}
                          >
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 600,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                              title={title}
                            >
                              {title}
                            </Typography>
                            {commentsTotal > 0 && (
                              <Chip
                                size="small"
                                label={String(commentsTotal)}
                                color={
                                  unreadComments > 0 ? "warning" : "default"
                                }
                                sx={{ height: 20, fontSize: 11, minWidth: 28 }}
                              />
                            )}
                          </Stack>
                        );
                      },
                    },
                    {
                      field: "locality",
                      headerName: "Loc.",
                      width: 86,
                      renderCell: (params) => {
                        const count = Number(
                          params.row.groupedLocalityCount ?? 1,
                        );
                        return (
                          <Chip
                            size="small"
                            label={String(count)}
                            title={`${count} localidade(s)`}
                            sx={{ height: 22, fontSize: 12, minWidth: 40 }}
                          />
                        );
                      },
                    },
                    {
                      field: "phase",
                      headerName: "Fase",
                      width: 110,
                      valueGetter: (_, row) =>
                        phaseMap.get(row.taskTemplate?.phaseId) ?? "-",
                    },
                    {
                      field: "specialty",
                      headerName: "Especialidade",
                      width: 130,
                      valueGetter: (_, row) => row.specialtyName ?? "Todas",
                    },
                    {
                      field: "dueDate",
                      headerName: "Prazo",
                      width: 152,
                      renderCell: (params) => (
                        <DueBadge
                          dueDate={params.row.dueDate}
                          status={params.row.status}
                        />
                      ),
                    },
                    {
                      field: "assignee",
                      headerName: "Responsável",
                      width: 145,
                      valueGetter: (_, row) =>
                        me?.executive_hide_pii
                          ? "-"
                          : (row.assignee?.label ??
                            row.assignee?.name ??
                            row.assignedTo?.name ??
                            row.assignedTo?.email ??
                            "-"),
                    },
                    {
                      field: "status",
                      headerName: "Status",
                      width: 120,
                      renderCell: (params) => (
                        <StatusChip
                          status={params.row.status}
                          isLate={params.row.isLate}
                        />
                      ),
                    },
                    {
                      field: "progress",
                      headerName: "Progresso",
                      width: 84,
                      valueGetter: (_, row) =>
                        `${Math.max(0, Math.min(100, Number(row.progressPercent ?? 0)))}%`,
                    },
                  ] as GridColDef[]
                }
                density="compact"
                rowHeight={40}
                columnHeaderHeight={42}
                checkboxSelection
                rowSelectionModel={selectionModel}
                onRowSelectionModelChange={(newModel) => {
                  if (Array.isArray(newModel)) {
                    setSelectionModel({
                      type: "include",
                      ids: new Set(newModel.map(String)),
                    } as GridRowSelectionModel);
                    return;
                  }
                  if (
                    newModel &&
                    typeof newModel === "object" &&
                    "type" in newModel &&
                    "ids" in newModel
                  ) {
                    const idsRaw = (newModel as any).ids;
                    const normalizedIds =
                      idsRaw instanceof Set
                        ? new Set(Array.from(idsRaw).map(String))
                        : Array.isArray(idsRaw)
                          ? new Set(idsRaw.map(String))
                          : new Set();
                    setSelectionModel({
                      type:
                        (newModel as any).type === "exclude"
                          ? "exclude"
                          : "include",
                      ids: normalizedIds,
                    } as GridRowSelectionModel);
                  }
                }}
                onRowClick={(params) =>
                  setSelectedTaskId(
                    String(params.row.primaryTaskId ?? params.row.id),
                  )
                }
                disableRowSelectionOnClick
              />
            </Box>
          </CardContent>
        </Card>
      )}

      {groupedRows.length > 0 && viewTab === 1 && (
        <Box
          display="grid"
          gridTemplateColumns={{
            xs: "1fr",
            md: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(3, minmax(0, 1fr))",
            xl: "repeat(5, minmax(0, 1fr))",
          }}
          gap={2}
        >
          {["NOT_STARTED", "STARTED", "IN_PROGRESS", "DONE"].map((column) => (
            <Card key={column}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {TASK_STATUS_LABELS[column] ?? column}
                </Typography>
                <Box display="grid" gap={1}>
                  {groupedRows
                    .filter((task: any) => task.status === column)
                    .map((task: any) => (
                      <Card
                        key={task.id}
                        variant="outlined"
                        sx={{ cursor: "pointer" }}
                        onClick={() =>
                          setSelectedTaskId(
                            String(task.primaryTaskId ?? task.id),
                          )
                        }
                      >
                        <CardContent>
                          <Typography variant="subtitle2">
                            {resolveTaskTitle(task)}
                          </Typography>
                          <DueBadge
                            dueDate={task.dueDate}
                            status={task.status}
                          />
                          {(task.comments?.unread ?? 0) > 0 && (
                            <Typography
                              variant="caption"
                              color="warning.main"
                              display="block"
                              sx={{ mt: 0.4 }}
                            >
                              Novo comentário ({task.comments.unread})
                            </Typography>
                          )}
                          {task.eloRole && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                              sx={{ mt: 0.5 }}
                            >
                              Elo: {task.eloRole.name ?? task.eloRole.code}
                            </Typography>
                          )}
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                            sx={{ mt: 0.5 }}
                          >
                            Especialidade: {task.specialtyName ?? "Todas"}
                          </Typography>
                          {task.meeting && (
                            <Link
                              component={RouterLink}
                              to={`/meetings?meetingId=${task.meeting.id}`}
                              onClick={(e) => e.stopPropagation()}
                              sx={{ fontSize: 11, mt: 0.5, display: "block" }}
                            >
                              Reunião:{" "}
                              {format(new Date(task.meeting.datetime), "dd/MM")}
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
        linkedTaskIds={selectedTaskGroup?.groupedTaskIds ?? []}
        linkedLocalities={selectedTaskGroup?.groupedLocalities ?? []}
      />

      <Drawer
        anchor="right"
        open={createDrawerOpen}
        onClose={() => setCreateDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: "100%", md: 560 },
            mt: `${APP_HEADER_HEIGHT}px`,
            height: `calc(100% - ${APP_HEADER_HEIGHT}px)`,
          },
        }}
      >
        <Box p={3} sx={{ height: "100%", overflowY: "auto" }}>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6">Nova tarefa</Typography>
              <Typography variant="body2" color="text.secondary">
                Crie tarefas por modelo ou manualmente, com uma única ação para
                várias localidades.
              </Typography>
            </Box>

            <Tabs
              value={createMode}
              onChange={(_, value) => setCreateMode(value)}
              sx={{ borderBottom: "1px solid #E3EAF3" }}
            >
              <Tab value="template" label="Usar modelo" />
              <Tab value="manual" label="Preenchimento manual" />
            </Tabs>

            {createMode === "template" && (
              <>
                <Autocomplete
                  options={templatesQuery.data?.items ?? []}
                  value={
                    (templatesQuery.data?.items ?? []).find(
                      (template: any) => template.id === createTemplateId,
                    ) ?? null
                  }
                  getOptionLabel={(option: any) =>
                    option.title ?? "Modelo sem título"
                  }
                  isOptionEqualToValue={(option: any, value: any) =>
                    option.id === value.id
                  }
                  onChange={(_, value) =>
                    setCreateTemplateId(String(value?.id ?? ""))
                  }
                  ListboxProps={{ style: { maxHeight: 280 } }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      label="Modelo da tarefa"
                      placeholder="Pesquise e selecione um modelo"
                    />
                  )}
                />

                {createTemplate && (
                  <Box
                    sx={{
                      p: 1.4,
                      border: "1px solid #DEE7F2",
                      borderRadius: 2,
                      bgcolor: "#F8FBFF",
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                      {createTemplate.title}
                    </Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`Fase: ${phaseMap.get(createTemplate.phaseId) ?? "Não definida"}`}
                    />
                  </Box>
                )}
              </>
            )}

            {createMode === "manual" && (
              <>
                <TextField
                  size="small"
                  label="Título da tarefa"
                  value={createManualTitle}
                  onChange={(event) => setCreateManualTitle(event.target.value)}
                  placeholder="Digite um título objetivo"
                  fullWidth
                />
                <TextField
                  select
                  size="small"
                  label="Fase"
                  value={createManualPhaseId}
                  onChange={(event) =>
                    setCreateManualPhaseId(event.target.value)
                  }
                  fullWidth
                >
                  <MenuItem value="">Selecionar fase</MenuItem>
                  {phases.map((phase) => (
                    <MenuItem key={phase.id} value={phase.id}>
                      {phase.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  size="small"
                  label="Descrição (opcional)"
                  value={createManualDescription}
                  onChange={(event) =>
                    setCreateManualDescription(event.target.value)
                  }
                  multiline
                  minRows={2}
                  fullWidth
                />
              </>
            )}

            <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
              <TextField
                select
                size="small"
                label="Escopo"
                value={createScope}
                onChange={(event) =>
                  setCreateScope(
                    event.target.value === "CIPAVD" ? "CIPAVD" : "SMIF",
                  )
                }
                fullWidth
              >
                <MenuItem value="SMIF">SMIF</MenuItem>
                <MenuItem value="CIPAVD">CIPAVD</MenuItem>
              </TextField>
              <TextField
                size="small"
                type="date"
                label="Prazo base"
                value={createBaseDate}
                onChange={(event) => setCreateBaseDate(event.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                select
                size="small"
                label="Prioridade"
                value={createPriority}
                onChange={(event) => setCreatePriority(event.target.value)}
                fullWidth
              >
                {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((priority) => (
                  <MenuItem key={priority} value={priority}>
                    {TASK_PRIORITY_LABELS[priority] ?? priority}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            <Autocomplete
              multiple
              disableCloseOnSelect
              options={createScopeLocalities}
              value={selectedCreateLocalities}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              onChange={(_, options) => {
                const ids = Array.from(
                  new Set(
                    options
                      .map((option) => String(option.id ?? "").trim())
                      .filter(Boolean),
                  ),
                );
                setCreateLocalityIds(ids);
                setCreateOffsets((prev) =>
                  ids.reduce((acc: Record<string, number>, id: string) => {
                    acc[id] = prev[id] ?? 0;
                    return acc;
                  }, {}),
                );
              }}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    {...getTagProps({ index })}
                    key={option.id}
                    label={option.name}
                    size="small"
                    variant="outlined"
                  />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  label="Localidades"
                  placeholder={
                    createLocalityIds.length
                      ? ""
                      : `Selecione uma ou mais localidades ${createScope}`
                  }
                />
              )}
            />

            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  const ids = Array.from(
                    new Set(
                      createScopeLocalities
                        .map((locality) => String(locality.id ?? "").trim())
                        .filter(Boolean),
                    ),
                  );
                  setCreateLocalityIds(ids);
                  setCreateOffsets(
                    ids.reduce((acc: Record<string, number>, id: string) => {
                      acc[id] = 0;
                      return acc;
                    }, {}),
                  );
                }}
              >
                Selecionar todas
              </Button>
              <Button
                size="small"
                onClick={() => {
                  setCreateLocalityIds([]);
                  setCreateOffsets({});
                }}
              >
                Limpar seleção
              </Button>
            </Stack>

            {createMode === "template" && (
              <>
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={createCustomOffsets}
                      onChange={(event) =>
                        setCreateCustomOffsets(event.target.checked)
                      }
                    />
                  }
                  label="Definir prazo individual por localidade"
                />

                {createCustomOffsets && createLocalityIds.length > 0 && (
                  <Box
                    sx={{
                      p: 1.4,
                      border: "1px dashed #CAD7E5",
                      borderRadius: 2,
                    }}
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block", mb: 1 }}
                    >
                      Ajuste os dias para mais (+) ou para menos (-) em relação
                      ao prazo base.
                    </Typography>
                    <Stack spacing={1}>
                      {selectedCreateLocalities.map((locality) => (
                        <TextField
                          key={locality.id}
                          size="small"
                          type="number"
                          label={locality.name}
                          value={createOffsets[locality.id] ?? 0}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            setCreateOffsets((prev) => ({
                              ...prev,
                              [locality.id]: Number.isFinite(value) ? value : 0,
                            }));
                          }}
                          inputProps={{ step: 1 }}
                        />
                      ))}
                    </Stack>
                  </Box>
                )}
              </>
            )}

            <Divider />

            <TextField
              select
              size="small"
              label="Responsável principal"
              value={createAssignedToId}
              onChange={(event) => {
                const value = String(event.target.value ?? "");
                setCreateAssignedToId(value);
                if (value && !createAssigneeIds.includes(value)) {
                  setCreateAssigneeIds((prev) => [...prev, value]);
                }
              }}
              fullWidth
              disabled={!canManageTaskAssignments || me?.executive_hide_pii}
            >
              <MenuItem value="">Sem responsável</MenuItem>
              {createAssigneeOptions.map((assignee) => (
                <MenuItem key={assignee.id} value={assignee.id}>
                  {assignee.name}
                </MenuItem>
              ))}
            </TextField>

            <Autocomplete
              multiple
              options={createAssigneeOptions}
              value={createAssigneeOptions.filter((assignee) =>
                createAssigneeIds.includes(assignee.id),
              )}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              onChange={(_, options) => {
                const ids = options.map((option) => option.id);
                setCreateAssigneeIds(ids);
                if (createAssignedToId && !ids.includes(createAssignedToId)) {
                  setCreateAssignedToId("");
                }
              }}
              disabled={!canManageTaskAssignments || me?.executive_hide_pii}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    {...getTagProps({ index })}
                    key={option.id}
                    label={option.name}
                    size="small"
                    variant="outlined"
                  />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  label="Demais responsáveis (opcional)"
                  placeholder="Selecione usuários"
                />
              )}
            />

            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                size="small"
                variant="outlined"
                color="error"
                sx={{ minHeight: 32, px: 1.5 }}
                onClick={() => setCreateDrawerOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                size="small"
                variant="contained"
                color="success"
                sx={{ minHeight: 32, px: 1.5 }}
                onClick={handleCreateTasks}
                disabled={
                  !canCreateTask ||
                  (createMode === "template" && !createTemplateId) ||
                  (createMode === "manual" &&
                    (!createManualTitle.trim() || !createManualPhaseId)) ||
                  !createBaseDate ||
                  createLocalityIds.length === 0 ||
                  generateInstances.isPending ||
                  createTaskInstance.isPending
                }
              >
                {generateInstances.isPending || createTaskInstance.isPending
                  ? "Criando..."
                  : "Criar tarefas"}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Drawer>

      <ConfirmDialog
        open={batchDeleteOpen}
        onCancel={() => setBatchDeleteOpen(false)}
        onConfirm={() => {
          void handleBatchDelete();
        }}
        title="Excluir tarefas selecionadas"
        message="Confirma a exclusão em lote das tarefas selecionadas?"
        highlightText={`${selectedIds.length} tarefa(s)`}
        note="Esta ação não pode ser desfeita."
        confirmLabel={
          batchDeleteMutation.isPending
            ? "Excluindo..."
            : "Excluir selecionadas"
        }
        severity="error"
        confirmLoading={batchDeleteMutation.isPending}
      />
    </Box>
  );
}
