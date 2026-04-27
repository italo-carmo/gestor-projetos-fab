import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  Link,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { format } from "date-fns";
import {
  useAddTaskComment,
  useAssignTask,
  useAuditLogs,
  useBatchDeleteTasks,
  useBatchProgressTasks,
  useBatchStatusTasks,
  useCipavdLocalities,
  useDeleteTask,
  useEloRoles,
  useLocalities,
  useMarkTaskCommentsSeen,
  useMeetings,
  useSpecialties,
  useTaskAssignees,
  useTaskComments,
  useUsers,
  useUpdateTaskEloRole,
  useUpdateTaskSpecialty,
  useUpdateTaskMeeting,
  useUpdateTaskProgress,
  useUpdateTaskStatus,
  useUpdateTaskTitle,
  useUpdateTaskLocalities,
  useUpdateTaskTemplate,
} from "../../api/hooks";
import { useToast } from "../../app/toast";
import { parseApiError } from "../../app/apiErrors";
import { can } from "../../app/rbac";
import { StatusChip } from "../chips/StatusChip";
import { ProgressInline } from "../chips/ProgressInline";
import { DueBadge } from "../chips/DueBadge";
import { EntityDocumentLinksManager } from "../documents/EntityDocumentLinksManager";
import { TaskStatus, TASK_STATUS_LABELS } from "../../constants/enums";
import { normalizeLocalityName } from "../../constants/localities";
import { formatDate } from "../../app/date";
import { ConfirmDialog } from "../dialogs/ConfirmDialog";

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

function uniqueLocalityIds(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)),
  );
}

function normalizeTaskScope(raw: unknown): "SMIF" | "CIPAVD" {
  return String(raw ?? "").trim().toUpperCase() === "CIPAVD"
    ? "CIPAVD"
    : "SMIF";
}

export type TaskDetailsDrawerProps = {
  task: any | null;
  open: boolean;
  onClose: () => void;
  onDeleted?: (id: string) => void;
  user: any | undefined;
  localities?: { id: string; name: string }[];
  linkedTaskIds?: string[];
  linkedLocalities?: { id: string; name: string }[];
  loading?: boolean;
};

const APP_HEADER_HEIGHT = 96;

export function TaskDetailsDrawer({
  task,
  open,
  onClose,
  onDeleted,
  user,
  localities = [],
  linkedTaskIds = [],
  linkedLocalities = [],
  loading = false,
}: TaskDetailsDrawerProps) {
  const [tab, setTab] = useState(0);
  const [selectedLocalityId, setSelectedLocalityId] = useState("");
  const [selectedAssigneeValue, setSelectedAssigneeValue] = useState("");
  const [commentText, setCommentText] = useState("");
  const [taskTitleDraft, setTaskTitleDraft] = useState("");
  const [taskScopeDraft, setTaskScopeDraft] = useState<"SMIF" | "CIPAVD">(
    "SMIF",
  );
  const [linkedLocalityIdsDraft, setLinkedLocalityIdsDraft] = useState<
    string[]
  >([]);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const toast = useToast();
  const updateStatus = useUpdateTaskStatus();
  const updateProgress = useUpdateTaskProgress();
  const batchStatusMutation = useBatchStatusTasks();
  const batchProgressMutation = useBatchProgressTasks();
  const batchDeleteTasks = useBatchDeleteTasks();
  const assignTask = useAssignTask();
  const addComment = useAddTaskComment();
  const markCommentsSeen = useMarkTaskCommentsSeen();
  const deleteTask = useDeleteTask();
  const updateTaskTemplate = useUpdateTaskTemplate();
  const updateTaskTitle = useUpdateTaskTitle();
  const updateTaskLocalities = useUpdateTaskLocalities();

  const canUpdate = can(user, "task_instances", "update");
  const canAssign = can(user, "task_instances", "assign");
  const canViewUsers = can(user, "users", "view");
  const canManageTaskData = canUpdate;
  const canDelete = can(user, "task_instances", "delete");
  const smifLocalitiesQuery = useLocalities();
  const cipavdLocalitiesQuery = useCipavdLocalities();
  const meetingsQuery = useMeetings({});
  const meetings = meetingsQuery.data?.items ?? [];
  const updateTaskMeeting = useUpdateTaskMeeting();
  const eloRolesQuery = useEloRoles();
  const eloRoles = eloRolesQuery.data?.items ?? [];
  const updateTaskEloRole = useUpdateTaskEloRole();
  const specialtiesQuery = useSpecialties();
  const specialties = specialtiesQuery.data?.items ?? [];
  const updateTaskSpecialty = useUpdateTaskSpecialty();
  const assigneesQuery = useTaskAssignees(selectedLocalityId);
  const usersQuery = useUsers(canViewUsers && !user?.executive_hide_pii);
  const assigneeOptions = useMemo(() => {
    const fromTaskAssignees = (assigneesQuery.data?.items ?? []) as any[];
    const users = (usersQuery.data?.items ?? []) as any[];
    const selectedLocality = String(selectedLocalityId ?? "").trim();
    const usersByLocality =
      selectedLocality.length > 0
        ? users.filter(
            (candidate: any) =>
              String(candidate?.localityId ?? "").trim() === selectedLocality,
          )
        : users;

    const merged = new Map<string, any>();
    fromTaskAssignees.forEach((option: any) => {
      const type = String(option?.type ?? "").trim();
      const id = String(option?.id ?? "").trim();
      if (!type || !id) return;
      merged.set(`${type}:${id}`, option);
    });

    usersByLocality
      .map((candidate: any) => {
        const id = String(candidate?.id ?? "").trim();
        if (!id) return null;
        return {
          type: "USER",
          id,
          label: String(
            candidate?.name ?? candidate?.email ?? `Usuário ${id.slice(0, 8)}`,
          ),
          subtitle: "Usuário",
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) =>
        String(a.label).localeCompare(String(b.label), "pt-BR"),
      )
      .forEach((option: any) => {
        const key = `USER:${String(option.id)}`;
        if (merged.has(key)) return;
        merged.set(key, option);
      });

    return Array.from(merged.values());
  }, [assigneesQuery.data?.items, selectedLocalityId, usersQuery.data?.items]);
  const commentsQuery = useTaskComments(task?.id ?? "");
  const auditQuery = useAuditLogs(
    task
      ? {
          resource: "task_instances",
          entityId: task.id,
        }
      : {},
  );
  const normalizedLinkedIds = useMemo(() => {
    const ids = [task?.id, ...linkedTaskIds]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean);
    return Array.from(new Set(ids));
  }, [task?.id, linkedTaskIds]);

  /** Evita reset do rascunho quando o pai re-renderiza com o mesmo conjunto de IDs (nova referência de array). */
  const linkedLocalitiesKey = useMemo(
    () =>
      linkedLocalities
        .map((l) => String(l?.id ?? "").trim())
        .filter(Boolean)
        .sort()
        .join("|"),
    [linkedLocalities],
  );
  const hasLinkedTasks = normalizedLinkedIds.length > 1;
  const hasCustomTitle = Boolean(String(task?.titleOverride ?? "").trim());
  const isManualTaskTemplate =
    String(task?.taskTemplate?.title ?? "")
      .trim()
      .toLowerCase() === "tarefa manual";
  const saveTitleByTaskInstance =
    hasCustomTitle || isManualTaskTemplate || hasLinkedTasks;
  const smifCatalogLocalities = useMemo(() => {
    const items = (smifLocalitiesQuery.data?.items ?? []) as any[];
    const merged = new Map<string, { id: string; name: string }>();
    [...items, ...localities].forEach((locality: any) => {
      const id = String(locality?.id ?? "").trim();
      if (!id || merged.has(id)) return;
      merged.set(id, {
        id,
        name:
          String(locality?.name ?? locality?.code ?? locality?.id ?? "").trim() ||
          id,
      });
    });
    return Array.from(merged.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR"),
    );
  }, [localities, smifLocalitiesQuery.data?.items]);
  const cipavdCatalogLocalities = useMemo(() => {
    const items = (cipavdLocalitiesQuery.data?.items ?? []) as any[];
    const merged = new Map<string, { id: string; name: string }>();
    items.forEach((locality: any) => {
      const id = String(locality?.id ?? "").trim();
      if (!id || merged.has(id)) return;
      merged.set(id, {
        id,
        name:
          String(locality?.name ?? locality?.code ?? locality?.id ?? "").trim() ||
          id,
      });
    });
    return Array.from(merged.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR"),
    );
  }, [cipavdLocalitiesQuery.data?.items]);
  const catalogLocalities =
    taskScopeDraft === "CIPAVD" ? cipavdCatalogLocalities : smifCatalogLocalities;
  const localityOptions = useMemo(() => {
    const optionMap = new Map<string, { id: string; name: string }>();
    const normalizedNameToId = new Map<string, string>();

    const addOption = (
      locality: { id?: string | null; name?: string | null },
      opts?: { prefer?: boolean; allowIfUnknownName?: boolean },
    ) => {
      const prefer = Boolean(opts?.prefer);
      const allowIfUnknownName =
        opts?.allowIfUnknownName === undefined
          ? true
          : Boolean(opts.allowIfUnknownName);
      const id = String(locality?.id ?? "").trim();
      if (!id) return;
      const name = String(locality?.name ?? id).trim() || id;
      const normalizedName = normalizeLocalityName(name);

      if (optionMap.has(id)) return;
      const existingIdByName = normalizedName
        ? normalizedNameToId.get(normalizedName)
        : undefined;
      if (existingIdByName) {
        if (!prefer) return;
        optionMap.delete(existingIdByName);
      } else if (!allowIfUnknownName) {
        return;
      }
      optionMap.set(id, { id, name });
      if (normalizedName) normalizedNameToId.set(normalizedName, id);
    };

    catalogLocalities.forEach((locality) => {
      addOption(locality, { prefer: true, allowIfUnknownName: true });
    });
    linkedLocalities.forEach((locality) => {
      addOption(
        {
          id: String(locality?.id ?? ""),
          name: String(locality?.name ?? ""),
        },
        { prefer: false, allowIfUnknownName: false },
      );
    });
    if (task?.localityId) {
      addOption(
        {
          id: String(task.localityId),
          name: String(task.localityName ?? "Localidade atual"),
        },
        { prefer: false, allowIfUnknownName: false },
      );
    }
    return Array.from(optionMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR"),
    );
  }, [catalogLocalities, linkedLocalities, task?.localityId, task?.localityName]);
  const editableLinkedLocalities =
    linkedLocalities.length > 0 || Boolean(task?.localityId);
  const filteredMeetings = useMemo(
    () =>
      meetings.filter(
        (meeting: any) =>
          normalizeTaskScope(meeting?.scope) === taskScopeDraft,
      ),
    [meetings, taskScopeDraft],
  );

  const assigneeValueFromTask = (taskItem: any) => {
    if (taskItem?.assignee?.type === "USER" && taskItem?.assignee?.id) {
      return `USER:${taskItem.assignee.id}`;
    }
    if (taskItem?.assignee?.type === "ELO" && taskItem?.assignee?.id) {
      return `ELO:${taskItem.assignee.id}`;
    }
    if (taskItem?.assignee?.type === "LOCALITY_COMMAND")
      return "LOCALITY_COMMAND";
    if (taskItem?.assignee?.type === "LOCALITY_COMMANDER")
      return "LOCALITY_COMMANDER";
    if (taskItem?.assignedToId) return `USER:${taskItem.assignedToId}`;
    if (taskItem?.assignedEloId) return `ELO:${taskItem.assignedEloId}`;
    return "";
  };

  useEffect(() => {
    if (!task) {
      setTaskScopeDraft("SMIF");
      setSelectedLocalityId("");
      setSelectedAssigneeValue("");
      setCommentText("");
      setTaskTitleDraft("");
      setConfirmDeleteOpen(false);
      return;
    }
    const nextTaskScope = normalizeTaskScope(task.scope);
    setTaskScopeDraft(nextTaskScope);
    const catalogSource =
      nextTaskScope === "CIPAVD"
        ? cipavdCatalogLocalities
        : smifCatalogLocalities;
    const taskLocalityId = String(task.localityId ?? "").trim();
    const catalogLocalityIds = new Set(
      catalogSource
        .map((locality) => String(locality?.id ?? "").trim())
        .filter(Boolean),
    );
    const catalogByNormalizedName = new Map(
      catalogSource
        .map((locality) => {
          const normalizedName = normalizeLocalityName(locality?.name);
          if (!normalizedName) return null;
          return [normalizedName, String(locality.id)] as const;
        })
        .filter(Boolean) as Array<readonly [string, string]>,
    );
    const taskNormalizedName = normalizeLocalityName(task.localityName);
    const canonicalTaskLocalityId =
      taskLocalityId && !catalogLocalityIds.has(taskLocalityId)
        ? ((taskNormalizedName
            ? catalogByNormalizedName.get(taskNormalizedName)
            : undefined) ?? "")
        : taskLocalityId;
    setSelectedLocalityId(canonicalTaskLocalityId);
    setSelectedAssigneeValue(assigneeValueFromTask(task));
    setCommentText("");
    setTaskTitleDraft(resolveTaskTitle(task));
    const linkedEntries =
      linkedLocalities.length > 0
        ? linkedLocalities
        : task.localityId
          ? [
              {
                id: String(task.localityId),
                name: String(task.localityName ?? ""),
              },
            ]
          : [];
    const linkedIds = linkedEntries
      .map((locality) => {
        const localityId = String(locality?.id ?? "").trim();
        if (!localityId) return "";
        if (catalogLocalityIds.has(localityId)) return localityId;
        const normalizedName = normalizeLocalityName(locality?.name);
        if (!normalizedName) return "";
        return catalogByNormalizedName.get(normalizedName) ?? "";
      })
      .filter(Boolean);
    setLinkedLocalityIdsDraft(uniqueLocalityIds(linkedIds));
  }, [
    task?.id,
    task?.scope,
    task?.localityId,
    task?.assignedToId,
    task?.assignedEloId,
    task?.assigneeType,
    cipavdCatalogLocalities,
    linkedLocalitiesKey,
    smifCatalogLocalities,
  ]);
  const linkedLocalityIdSet = useMemo(
    () => new Set(uniqueLocalityIds(linkedLocalityIdsDraft)),
    [linkedLocalityIdsDraft],
  );

  useEffect(() => {
    const optionIds = new Set(
      localityOptions.map((option) => String(option.id ?? "").trim()),
    );
    if (selectedLocalityId && !optionIds.has(String(selectedLocalityId))) {
      setSelectedLocalityId("");
      setSelectedAssigneeValue("");
    }
    setLinkedLocalityIdsDraft((prev) =>
      prev.filter((value) => optionIds.has(String(value ?? "").trim())),
    );
  }, [localityOptions, selectedLocalityId]);

  useEffect(() => {
    if (!open || !task?.id) return;
    void markCommentsSeen.mutateAsync(task.id).catch(() => {});
  }, [open, task?.id]);

  const handleStatus = async (status: string) => {
    if (!task) return;
    try {
      if (hasLinkedTasks) {
        await batchStatusMutation.mutateAsync({
          ids: normalizedLinkedIds,
          status,
        });
      } else {
        await updateStatus.mutateAsync({ id: task.id, status });
      }
      toast.push({ message: "Status atualizado", severity: "success" });
    } catch (error) {
      const payload = parseApiError(error);
      if (payload.code === "RBAC_FORBIDDEN") {
        toast.push({ message: "Acesso negado", severity: "error" });
      } else {
        toast.push({
          message: payload.message ?? "Erro ao atualizar",
          severity: "error",
        });
      }
    }
  };

  const handleProgress = async (value: number) => {
    if (!task) return;
    try {
      if (hasLinkedTasks) {
        await batchProgressMutation.mutateAsync({
          ids: normalizedLinkedIds,
          progressPercent: value,
        });
      } else {
        await updateProgress.mutateAsync({
          id: task.id,
          progressPercent: value,
        });
      }
      toast.push({ message: "Progresso atualizado", severity: "success" });
    } catch (error) {
      const payload = parseApiError(error);
      if (payload.code === "RBAC_FORBIDDEN") {
        toast.push({ message: "Acesso negado", severity: "error" });
      } else {
        toast.push({
          message: payload.message ?? "Erro ao atualizar",
          severity: "error",
        });
      }
    }
  };

  const handleAssign = async (rawValue: string) => {
    if (!task) return;
    const value = rawValue.trim();
    let assigneeType:
      | "USER"
      | "ELO"
      | "LOCALITY_COMMAND"
      | "LOCALITY_COMMANDER"
      | null = null;
    let assigneeId: string | null = null;
    if (value.startsWith("USER:")) {
      assigneeType = "USER";
      assigneeId = value.slice("USER:".length);
    } else if (value.startsWith("ELO:")) {
      assigneeType = "ELO";
      assigneeId = value.slice("ELO:".length);
    } else if (value === "LOCALITY_COMMAND" || value === "LOCALITY_COMMANDER") {
      assigneeType = value;
    }
    try {
      await assignTask.mutateAsync({
        id: task.id,
        localityId: selectedLocalityId || task.localityId,
        assigneeType,
        assigneeId,
      });
      setSelectedAssigneeValue(value);
      toast.push({ message: "Responsável atualizado", severity: "success" });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? "Erro ao atualizar",
        severity: "error",
      });
    }
  };

  const handleMeetingChange = async (meetingId: string) => {
    if (!task) return;
    try {
      await updateTaskMeeting.mutateAsync({
        id: task.id,
        meetingId: meetingId || null,
      });
      toast.push({
        message: "Vínculo com reunião atualizado",
        severity: "success",
      });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? "Erro ao atualizar",
        severity: "error",
      });
    }
  };

  const handleEloRoleChange = async (eloRoleId: string) => {
    if (!task) return;
    try {
      await updateTaskEloRole.mutateAsync({
        id: task.id,
        eloRoleId: eloRoleId || null,
      });
      toast.push({ message: "Elo atualizado", severity: "success" });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? "Erro ao atualizar",
        severity: "error",
      });
    }
  };

  const handleSpecialtyChange = async (specialtyId: string) => {
    if (!task) return;
    try {
      await updateTaskSpecialty.mutateAsync({
        id: task.id,
        specialtyId: specialtyId || null,
      });
      toast.push({ message: "Especialidade atualizada", severity: "success" });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? "Erro ao atualizar",
        severity: "error",
      });
    }
  };

  const handleAddComment = async () => {
    if (!task) return;
    const text = commentText.trim();
    if (!text) return;
    try {
      await addComment.mutateAsync({ id: task.id, text });
      setCommentText("");
      toast.push({ message: "Comentário registrado", severity: "success" });
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? "Erro ao comentar",
        severity: "error",
      });
    }
  };

  const handleSave = async () => {
    if (!task || !canManageTaskData) return;

    const nextTitle = taskTitleDraft.trim();
    const titleChanged = !!nextTitle && nextTitle !== resolveTaskTitle(task);

    const nextLocalityIds = Array.from(
      new Set(linkedLocalityIdsDraft.map((value) => String(value).trim())),
    ).filter(Boolean);

    let didSomething = false;

    try {
      if (titleChanged) {
        if (saveTitleByTaskInstance) {
          for (const id of normalizedLinkedIds) {
            await updateTaskTitle.mutateAsync({ id, title: nextTitle });
          }
        } else {
          const templateId = String(
            task.taskTemplateId ?? task.taskTemplate?.id ?? "",
          ).trim();
          if (templateId) {
            await updateTaskTemplate.mutateAsync({
              id: templateId,
              payload: {
                title: nextTitle,
              },
            });
          }
        }
        didSomething = true;
      }

      if (editableLinkedLocalities) {
        if (!nextLocalityIds.length) {
          toast.push({
            message: "Selecione ao menos uma localidade.",
            severity: "warning",
          });
        } else {
          await updateTaskLocalities.mutateAsync({
            id: task.id,
            scope: taskScopeDraft,
            localityIds: nextLocalityIds,
            sourceTaskIds: normalizedLinkedIds,
          });
          if (!nextLocalityIds.includes(selectedLocalityId)) {
            setSelectedLocalityId(nextLocalityIds[0] ?? "");
            setSelectedAssigneeValue("");
          }
          didSomething = true;
        }
      }

      if (didSomething) {
        toast.push({
          message: "Alterações salvas",
          severity: "success",
        });
      } else {
        toast.push({
          message: "Nenhuma alteração para salvar.",
          severity: "info",
        });
      }
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? "Erro ao salvar alterações",
        severity: "error",
      });
    }
  };

  const handleDelete = async () => {
    if (!task || !canDelete) return;
    setConfirmDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!task || !canDelete) return;
    try {
      if (hasLinkedTasks) {
        await batchDeleteTasks.mutateAsync({ ids: normalizedLinkedIds });
      } else {
        await deleteTask.mutateAsync(task.id);
      }
      setConfirmDeleteOpen(false);
      toast.push({
        message: hasLinkedTasks
          ? "Tarefas vinculadas excluídas"
          : "Tarefa excluída",
        severity: "success",
      });
      onDeleted?.(task.id);
      onClose();
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? "Erro ao excluir tarefa",
        severity: "error",
      });
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100%", md: 520 },
          mt: `${APP_HEADER_HEIGHT}px`,
          height: `calc(100% - ${APP_HEADER_HEIGHT}px)`,
        },
      }}
    >
      <Box
        p={3}
        display="flex"
        flexDirection="column"
        height="100%"
        data-testid="task-drawer"
      >
        {task ? (
          <>
            <Stack spacing={1}>
              <Typography variant="h5">
                {taskTitleDraft.trim() || resolveTaskTitle(task)}
              </Typography>
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                flexWrap="wrap"
              >
                <StatusChip status={task.status} isLate={task.isLate} />
                <DueBadge dueDate={task.dueDate} status={task.status} />
              </Stack>
            </Stack>

            <Tabs
              value={tab}
              onChange={(_, value) => setTab(value)}
              sx={{ mt: 2 }}
            >
              <Tab label="Detalhes" />
              <Tab
                label={`Comentários${task.comments?.hasUnread ? " • novo" : ""}`}
              />
              <Tab label="Histórico" />
            </Tabs>
            <Divider sx={{ my: 2 }} />

            {tab === 0 && (
              <Stack spacing={2}>
                <TextField
                  size="small"
                  label="Título da tarefa"
                  value={taskTitleDraft}
                  onChange={(e) => setTaskTitleDraft(e.target.value)}
                  disabled={
                    !canManageTaskData ||
                    updateTaskTemplate.isPending ||
                    updateTaskTitle.isPending
                  }
                  helperText={
                    saveTitleByTaskInstance
                      ? "A alteração será aplicada para todas as localidades vinculadas."
                      : "A alteração atualiza o título do modelo vinculado."
                  }
                />
                {editableLinkedLocalities && (
                  <Box>
                    <TextField
                      select
                      size="small"
                      label="Escopo"
                      value={taskScopeDraft}
                      onChange={(event) =>
                        setTaskScopeDraft(
                          event.target.value === "CIPAVD" ? "CIPAVD" : "SMIF",
                        )
                      }
                      disabled={!canManageTaskData || updateTaskLocalities.isPending}
                      sx={{ mb: 1.5, maxWidth: 220 }}
                    >
                      <MenuItem value="SMIF">SMIF</MenuItem>
                      <MenuItem value="CIPAVD">CIPAVD</MenuItem>
                    </TextField>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                      gutterBottom
                    >
                      Localidades vinculadas ({linkedLocalityIdsDraft.length})
                    </Typography>
                    <Autocomplete
                      multiple
                      size="small"
                      options={localityOptions}
                      value={localityOptions.filter((option) =>
                        linkedLocalityIdSet.has(String(option.id).trim()),
                      )}
                      getOptionLabel={(option) => option.name}
                      isOptionEqualToValue={(option, value) =>
                        option.id === value.id
                      }
                      onChange={(_, values) =>
                        setLinkedLocalityIdsDraft(
                          uniqueLocalityIds(values.map((value) => value.id)),
                        )
                      }
                      disabled={
                        !canManageTaskData || updateTaskLocalities.isPending
                      }
                      renderTags={(value, getTagProps) =>
                        value.map((option, index) => (
                          <Chip
                            {...getTagProps({ index })}
                            key={option.id}
                            size="small"
                            variant="outlined"
                            label={option.name}
                          />
                        ))
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder="Selecione as localidades"
                          helperText={
                            canManageTaskData
                              ? "Edite as localidades vinculadas desta tarefa."
                              : "Somente Comissão e TI podem editar localidades."
                          }
                        />
                      )}
                    />
                    {canManageTaskData && localityOptions.length > 0 && (
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ mt: 1 }}
                        flexWrap="wrap"
                      >
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={updateTaskLocalities.isPending}
                          onClick={() =>
                            setLinkedLocalityIdsDraft(
                              uniqueLocalityIds(
                                localityOptions.map((option) => option.id),
                              ),
                            )
                          }
                        >
                          Selecionar todas
                        </Button>
                        <Button
                          size="small"
                          disabled={updateTaskLocalities.isPending}
                          onClick={() => setLinkedLocalityIdsDraft([])}
                        >
                          Limpar seleção
                        </Button>
                      </Stack>
                    )}
                  </Box>
                )}
                <TextField
                  select
                  label="Status"
                  size="small"
                  value={task.status}
                  onChange={(e) => handleStatus(e.target.value)}
                  disabled={!canManageTaskData}
                  data-testid="task-status"
                >
                  {TaskStatus.map((status) => (
                    <MenuItem key={status} value={status}>
                      {TASK_STATUS_LABELS[status] ?? status}
                    </MenuItem>
                  ))}
                </TextField>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Progresso
                  </Typography>
                  <ProgressInline value={task.progressPercent ?? 0} />
                  <TextField
                    size="small"
                    type="number"
                    value={task.progressPercent ?? 0}
                    onChange={(e) => handleProgress(Number(e.target.value))}
                    inputProps={{ min: 0, max: 100 }}
                    disabled={!canManageTaskData}
                    sx={{ mt: 1, maxWidth: 120 }}
                    data-testid="task-progress"
                  />
                </Box>
                <TextField
                  size="small"
                  label="Prazo"
                  value={formatDate(task.dueDate)}
                  InputProps={{ readOnly: true }}
                />
                <TextField
                  select
                  size="small"
                  label="Localidade do responsável"
                  value={selectedLocalityId}
                  onChange={(e) => {
                    setSelectedLocalityId(e.target.value);
                    setSelectedAssigneeValue("");
                  }}
                  disabled={!canAssign || user?.executive_hide_pii}
                >
                  {localityOptions.map((loc) => (
                    <MenuItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  size="small"
                  label="Responsável"
                  value={selectedAssigneeValue}
                  onChange={(e) => handleAssign(e.target.value)}
                  disabled={
                    !canAssign ||
                    user?.executive_hide_pii ||
                    !selectedLocalityId
                  }
                  data-testid="task-assign"
                  helperText={
                    selectedLocalityId
                      ? "Selecione usuário, elo, GSD ou comandante da localidade."
                      : "Escolha uma localidade."
                  }
                >
                  <MenuItem value="">Nenhum</MenuItem>
                  {assigneeOptions.map((option: any) => {
                    const optionValue =
                      option.type === "USER" || option.type === "ELO"
                        ? `${option.type}:${option.id}`
                        : option.type;
                    return (
                      <MenuItem
                        key={`${option.type}:${option.id}`}
                        value={optionValue}
                      >
                        {option.label}
                        {option.subtitle ? ` — ${option.subtitle}` : ""}
                      </MenuItem>
                    );
                  })}
                </TextField>
                {!user?.executive_hide_pii && task.assigneeLabel && (
                  <Typography variant="caption" color="text.secondary">
                    Atual: {task.assigneeLabel}
                  </Typography>
                )}
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                    gutterBottom
                  >
                    Especialidade (opcional)
                  </Typography>
                  <TextField
                    select
                    size="small"
                    fullWidth
                    value={task.specialtyId ?? ""}
                    onChange={(e) => handleSpecialtyChange(e.target.value)}
                    disabled={!canManageTaskData}
                  >
                    <MenuItem value="">Todas as especialidades</MenuItem>
                    {specialties.map((s: any) => (
                      <MenuItem key={s.id} value={s.id}>
                        {s.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                    gutterBottom
                  >
                    Vinculada à reunião
                  </Typography>
                    <TextField
                    select
                    size="small"
                    fullWidth
                    value={task.meetingId ?? ""}
                    onChange={(e) => handleMeetingChange(e.target.value)}
                    disabled={!canManageTaskData}
                  >
                    <MenuItem value="">Nenhuma</MenuItem>
                    {filteredMeetings.map((m: any) => (
                      <MenuItem key={m.id} value={m.id}>
                        {format(new Date(m.datetime), "dd/MM/yyyy HH:mm")} —{" "}
                        {m.scope || "Reunião"}
                      </MenuItem>
                    ))}
                  </TextField>
                  {task.meeting && (
                    <Link
                      component={RouterLink}
                      to={`/meetings?meetingId=${task.meeting.id}`}
                      sx={{ mt: 1, display: "inline-block", fontSize: 13 }}
                    >
                      Ver reunião →
                    </Link>
                  )}
                </Box>
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                    gutterBottom
                  >
                    Elo (Psicologia, SSO, Jurídico, etc.)
                  </Typography>
                  <TextField
                    select
                    size="small"
                    fullWidth
                    value={task.eloRoleId ?? ""}
                    onChange={(e) => handleEloRoleChange(e.target.value)}
                    disabled={!canManageTaskData}
                  >
                    <MenuItem value="">Nenhum</MenuItem>
                    {eloRoles.map((r: any) => (
                      <MenuItem key={r.id} value={r.id}>
                        {r.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>
                <Stack direction="row" spacing={1} sx={{ width: "100%" }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleStatus("IN_PROGRESS")}
                    disabled={!canManageTaskData}
                    sx={{ minHeight: 30, px: 1.5, flex: 1 }}
                  >
                    Iniciar
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    color="success"
                    onClick={() => handleStatus("DONE")}
                    disabled={!canManageTaskData}
                    data-testid="task-mark-done"
                    sx={{ minHeight: 30, px: 1.5, flex: 1 }}
                  >
                    Concluir
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="success"
                    onClick={handleSave}
                    disabled={
                      !canManageTaskData ||
                      updateTaskTemplate.isPending ||
                      updateTaskTitle.isPending ||
                      updateTaskLocalities.isPending
                    }
                    data-testid="task-save"
                    sx={{ minHeight: 30, px: 1.5, flex: 1 }}
                  >
                    Salvar
                  </Button>
                  {canDelete && (
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      onClick={handleDelete}
                      disabled={
                        deleteTask.isPending || batchDeleteTasks.isPending
                      }
                      sx={{ minHeight: 30, px: 1.5, flex: 1 }}
                    >
                      Excluir
                    </Button>
                  )}
                </Stack>
                <EntityDocumentLinksManager
                  entityType="TASK_INSTANCE"
                  entityId={task.id}
                  canManage={canManageTaskData}
                  title="Documentos da tarefa"
                />
              </Stack>
            )}

            {tab === 1 && (
              <Stack spacing={1.5}>
                <TextField
                  size="small"
                  label="Novo comentário"
                  multiline
                  minRows={2}
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  disabled={!canManageTaskData}
                  placeholder="Escreva pendências, orientações, alinhamentos e observações..."
                />
                <Box display="flex" justifyContent="flex-end">
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleAddComment}
                    disabled={
                      !canManageTaskData ||
                      !commentText.trim() ||
                      addComment.isPending
                    }
                  >
                    Comentar
                  </Button>
                </Box>
                <Divider />
                {(commentsQuery.data?.items ?? []).length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Sem comentários até o momento.
                  </Typography>
                )}
                <Stack spacing={1.2}>
                  {(commentsQuery.data?.items ?? []).map((comment: any) => (
                    <Box
                      key={comment.id}
                      sx={{
                        borderLeft: "3px solid #0C657E",
                        pl: 1.2,
                        py: 0.5,
                        bgcolor: "#F8FBFD",
                        borderRadius: 1,
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        {comment.authorName} •{" "}
                        {new Date(comment.createdAt).toLocaleString("pt-BR")}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ whiteSpace: "pre-wrap" }}
                      >
                        {comment.text}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Stack>
            )}

            {tab === 2 && (
              <Stack spacing={1}>
                {(auditQuery.data?.items ?? []).length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Nenhum evento registrado.
                  </Typography>
                )}
                {(auditQuery.data?.items ?? []).map((log: any) => (
                  <Box
                    key={log.id}
                    sx={{ border: "1px solid #E6ECF5", borderRadius: 2, p: 1 }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {new Date(log.createdAt).toLocaleString("pt-BR")}
                    </Typography>
                    <Typography variant="body2">
                      {log.action} por{" "}
                      {log.user?.name ?? log.userId ?? "Sistema"}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}

            <ConfirmDialog
              open={confirmDeleteOpen}
              onCancel={() => setConfirmDeleteOpen(false)}
              onConfirm={handleConfirmDelete}
              title="Excluir tarefa"
              message="Você tem certeza que deseja excluir esta tarefa?"
              highlightText={taskTitleDraft.trim() || resolveTaskTitle(task)}
              note="Esta ação será registrada em auditoria e não pode ser desfeita."
              confirmLabel={
                deleteTask.isPending || batchDeleteTasks.isPending
                  ? "Excluindo..."
                  : "Excluir tarefa"
              }
              severity="error"
              confirmLoading={
                deleteTask.isPending || batchDeleteTasks.isPending
              }
            />
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {loading
              ? "Carregando detalhes da tarefa..."
              : "Nenhuma tarefa selecionada."}
          </Typography>
        )}
      </Box>
    </Drawer>
  );
}
