import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "./client";
import { qk } from "./queryKeys";
import {
  splitMilitaryNameAndOm,
  toMilitaryDisplayName,
} from "../app/militaryName";

/**
 * Tarefas recém-criadas podem não vir na 1ª página (ordem por prazo + paginação).
 * Mantemos um buffer temporário em memória e o `select` de useTasks reinjeta os
 * itens pendentes que ainda combinam com os filtros da query observada.
 */
type PendingCreatedTaskEntry = {
  item: any;
  createdAtMs: number;
  seenInServerAtMs?: number;
};

const pendingCreatedTaskById = new Map<string, PendingCreatedTaskEntry>();
const PENDING_CREATED_TASK_TTL_MS = 10 * 60_000;
const PENDING_CREATED_TASK_SEEN_EVICT_MS = 2 * 60_000;

function stashPendingCreatedTasks(items: any[]) {
  const now = Date.now();
  for (const it of items ?? []) {
    const id = String(it?.id ?? "").trim();
    if (!id) continue;
    const existing = pendingCreatedTaskById.get(id);
    pendingCreatedTaskById.set(id, {
      item: it,
      createdAtMs: existing?.createdAtMs ?? now,
      seenInServerAtMs: existing?.seenInServerAtMs,
    });
  }
}

function normalizeTaskIds(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      (values ?? []).map((value) => String(value ?? "").trim()).filter(Boolean),
    ),
  );
}

function takePendingCreatedTasksByIds(taskIds: string[]) {
  const removed = new Map<string, PendingCreatedTaskEntry>();
  for (const id of taskIds) {
    const existing = pendingCreatedTaskById.get(id);
    if (!existing) continue;
    removed.set(id, existing);
    pendingCreatedTaskById.delete(id);
  }
  return removed;
}

function restorePendingCreatedTasks(
  removed: Map<string, PendingCreatedTaskEntry> | undefined,
) {
  if (!removed || removed.size === 0) return;
  for (const [id, entry] of removed.entries()) {
    pendingCreatedTaskById.set(id, entry);
  }
}

function removeTaskIdsFromTasksPageData(data: any, idSet: Set<string>) {
  if (!data || typeof data !== "object" || !Array.isArray(data.items))
    return data;
  const beforeItems = data.items as any[];
  const nextItems = beforeItems.filter(
    (item: any) => !idSet.has(String(item?.id ?? "").trim()),
  );
  if (nextItems.length === beforeItems.length) return data;
  const removedCount = beforeItems.length - nextItems.length;
  const nextTotal =
    typeof data.total === "number"
      ? Math.max(0, Number(data.total) - removedCount)
      : data.total;
  return {
    ...data,
    items: nextItems,
    total: nextTotal,
  };
}

function removeTaskIdsFromTasksQueries(
  qc: ReturnType<typeof useQueryClient>,
  taskIds: string[],
) {
  if (taskIds.length === 0) return;
  const idSet = new Set(taskIds);
  qc.setQueriesData({ queryKey: ["tasks"] }, (old: any) =>
    removeTaskIdsFromTasksPageData(old, idSet),
  );
}

/** Dispara reexecução do `select` (merge com buffer) antes do refetch assíncrono. */
function touchTasksQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.setQueriesData({ queryKey: ["tasks"] }, (old: any) =>
    old && typeof old === "object" ? { ...old } : old,
  );
}

function parseDateSafe(value: unknown): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = new Date(raw).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function getTaskAssigneeIds(task: any) {
  const fromResponsibles = Array.isArray(task?.responsibleUsers)
    ? task.responsibleUsers
        .map((entry: any) => String(entry?.id ?? "").trim())
        .filter(Boolean)
    : Array.isArray(task?.responsibles)
      ? task.responsibles
          .map((entry: any) =>
            String(entry?.userId ?? entry?.user?.id ?? "").trim(),
          )
          .filter(Boolean)
      : [];
  const assignedToId = String(task?.assignedToId ?? "").trim();
  return new Set(
    [assignedToId, ...fromResponsibles]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean),
  );
}

function taskMatchesFilters(task: any, filters: Record<string, any>) {
  if (!task || typeof task !== "object") return false;

  const scopeFilter = String(filters.scope ?? "")
    .trim()
    .toUpperCase();
  const taskScope = String(task.scope ?? "SMIF")
    .trim()
    .toUpperCase();
  if (scopeFilter && taskScope !== scopeFilter) {
    return false;
  }

  const localityFilter = String(filters.localityId ?? "").trim();
  if (
    localityFilter &&
    String(task.localityId ?? "").trim() !== localityFilter
  ) {
    return false;
  }

  const phaseFilter = String(filters.phaseId ?? "").trim();
  if (phaseFilter) {
    const taskPhaseId = String(
      task.taskTemplate?.phaseId ?? task.phaseId ?? "",
    ).trim();
    if (taskPhaseId !== phaseFilter) return false;
  }

  const statusFilter = String(filters.status ?? "").trim();
  if (statusFilter && String(task.status ?? "").trim() !== statusFilter) {
    return false;
  }

  const eloRoleFilter = String(filters.eloRoleId ?? "").trim();
  if (eloRoleFilter && String(task.eloRoleId ?? "").trim() !== eloRoleFilter) {
    return false;
  }

  const assigneeIdsFilter = String(filters.assigneeIds ?? "").trim();
  const assigneeIdFilter = String(filters.assigneeId ?? "").trim();
  const taskAssigneeIds = getTaskAssigneeIds(task);
  if (assigneeIdsFilter) {
    const selected = assigneeIdsFilter
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (
      selected.length > 0 &&
      !selected.some((id) => taskAssigneeIds.has(id))
    ) {
      return false;
    }
  } else if (assigneeIdFilter && !taskAssigneeIds.has(assigneeIdFilter)) {
    return false;
  }

  const dueTs = parseDateSafe(task.dueDate);
  const dueFromTs = parseDateSafe(filters.dueFrom);
  const dueToTs = parseDateSafe(filters.dueTo);
  if (dueTs !== null && dueFromTs !== null && dueTs < dueFromTs) return false;
  if (dueTs !== null && dueToTs !== null && dueTs > dueToTs) return false;

  return true;
}

function mergePendingIntoTasksPageData(
  data: any,
  filters: Record<string, any>,
): any {
  if (!data || typeof data !== "object") return data;
  const now = Date.now();
  const items = Array.isArray(data.items) ? data.items : [];
  const serverIds = new Set(items.map((t: any) => String(t.id)));

  for (const [id, entry] of [...pendingCreatedTaskById.entries()]) {
    if (now - entry.createdAtMs > PENDING_CREATED_TASK_TTL_MS) {
      pendingCreatedTaskById.delete(id);
      continue;
    }
    if (serverIds.has(id)) {
      if (!entry.seenInServerAtMs) entry.seenInServerAtMs = now;
      if (now - entry.seenInServerAtMs > PENDING_CREATED_TASK_SEEN_EVICT_MS) {
        pendingCreatedTaskById.delete(id);
      }
    }
  }

  const pending = [...pendingCreatedTaskById.values()]
    .map((entry) => entry.item)
    .filter(
      (p) =>
        p?.id && !serverIds.has(String(p.id)) && taskMatchesFilters(p, filters),
    );
  const dedupPending = pending.filter(
    (item, index, arr) =>
      arr.findIndex((candidate) => String(candidate.id) === String(item.id)) ===
      index,
  );
  if (dedupPending.length === 0) return data;
  return {
    ...data,
    items: [...dedupPending, ...items],
  };
}

function normalizeSigpesNumeroOrdem(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  if (/^\d+[.,]\d+$/.test(raw)) {
    const parsed = Number.parseFloat(raw.replace(",", "."));
    if (Number.isFinite(parsed) && Number.isInteger(parsed)) {
      return String(parsed);
    }
  }

  const trailingZeroSuffix = raw.match(/^(\d+)[-\s]0+$/);
  if (trailingZeroSuffix) {
    return trailingZeroSuffix[1];
  }

  const onlyDigits = raw.replace(/\D/g, "");
  return onlyDigits || raw;
}

export function useMe() {
  return useQuery({
    queryKey: qk.me,
    queryFn: async () => (await api.get("/auth/me")).data,
  });
}

export function useMyFabProfile() {
  return useQuery({
    queryKey: qk.myFabProfile,
    queryFn: async () => (await api.get("/auth/me/fab-profile")).data,
    staleTime: 60_000,
    retry: false,
  });
}

export function useSigpesPhoto(numeroOrdem: string | null | undefined) {
  const normalizedNumeroOrdem = normalizeSigpesNumeroOrdem(numeroOrdem);
  return useQuery({
    queryKey: qk.sigpesPhoto(normalizedNumeroOrdem),
    queryFn: async () => {
      try {
        return (
          await api.get(
            `/auth/fotoes/${encodeURIComponent(normalizedNumeroOrdem)}`,
          )
        ).data;
      } catch {
        return {
          numeroOrdem: normalizedNumeroOrdem,
          mimeType: null,
          fileName: null,
          base64: null,
          dataUrl: null,
        };
      }
    },
    enabled: Boolean(normalizedNumeroOrdem),
    staleTime: 15 * 60_000,
    retry: 1,
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: async (args: { login: string; password: string }) =>
      (await api.post("/auth/login", args)).data,
  });
}

export function useConfirmTwoFactorSetup() {
  return useMutation({
    mutationFn: async (args: { setupToken: string; code: string }) =>
      (await api.post("/auth/2fa/confirm-setup", args)).data,
  });
}

export function useVerifyTwoFactor() {
  return useMutation({
    mutationFn: async (args: { twoFactorToken: string; code: string }) =>
      (await api.post("/auth/2fa/verify", args)).data,
  });
}

export function useResetTwoFactor() {
  return useMutation({
    mutationFn: async (userId: string) =>
      (
        await api.post(
          `/admin/rbac/users/${encodeURIComponent(userId)}/reset-2fa`,
        )
      ).data,
  });
}

export function useUserTwoFactorStatus(userId: string, enabled = true) {
  return useQuery({
    queryKey: ["user-2fa-status", userId],
    queryFn: async () =>
      (
        await api.get(
          `/admin/rbac/users/${encodeURIComponent(userId)}/2fa-status`,
        )
      ).data as {
        totpEnabled: boolean;
      },
    enabled: enabled && Boolean(userId),
    staleTime: 30_000,
  });
}

export function useTasks(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.tasks(filters),
    queryFn: async () =>
      (await api.get("/task-instances", { params: filters })).data,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    select: (data) => mergePendingIntoTasksPageData(data, filters),
  });
}

export function useTaskInstance(id: string, enabled = true) {
  return useQuery({
    queryKey: qk.task(id),
    queryFn: async () => (await api.get(`/task-instances/${id}`)).data,
    enabled: Boolean(id) && enabled,
    staleTime: 15_000,
  });
}

export function useActivities(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.activities(filters),
    queryFn: async () =>
      (await api.get("/activities", { params: filters })).data,
    staleTime: 15_000,
  });
}

export function useActivity(id: string, enabled = true) {
  return useQuery({
    queryKey: qk.activity(id || ""),
    queryFn: async () => (await api.get(`/activities/${id}`)).data,
    enabled: Boolean(id) && enabled,
    staleTime: 15_000,
  });
}

export function useActivityResponsibleUsers(filters: {
  localityId?: string;
  specialtyId?: string;
}) {
  const normalized = {
    localityId: filters.localityId || undefined,
    specialtyId: filters.specialtyId || undefined,
  };
  return useQuery({
    queryKey: ["activityResponsibleUsers", normalized],
    queryFn: async () =>
      (await api.get("/activities/responsible-users", { params: normalized }))
        .data,
    staleTime: 15_000,
  });
}

export function useActivityTypes(scope: string) {
  const normalizedScope = scope === "CIPAVD" ? "CIPAVD" : "SMIF";
  return useQuery({
    queryKey: qk.activityTypes(normalizedScope),
    queryFn: async () =>
      (
        await api.get("/activities/types", {
          params: { scope: normalizedScope },
        })
      ).data,
    staleTime: 60_000,
  });
}

export function useMissions(filters: Record<string, any>, enabled = true) {
  return useQuery({
    queryKey: qk.missions(filters),
    queryFn: async () => (await api.get("/missions", { params: filters })).data,
    enabled,
    staleTime: 10_000,
  });
}

export function useMissionLocalityOptions(scope: string, enabled = true) {
  return useQuery({
    queryKey: ["missions", "locality-options", scope],
    queryFn: async () =>
      (
        await api.get("/missions/locality-options", {
          params: { scope: scope || "SMIF" },
        })
      ).data,
    enabled,
    staleTime: 60_000,
  });
}

export function useMissionStatistics(scope: string = "SMIF", enabled = true) {
  return useQuery({
    queryKey: ["missions", "statistics", scope],
    queryFn: async () =>
      (
        await api.get("/missions/statistics", {
          params: { scope: scope || "SMIF" },
        })
      ).data,
    enabled,
    staleTime: 30_000,
  });
}

export function useMission(id: string, enabled = true) {
  return useQuery({
    queryKey: qk.mission(id || ""),
    queryFn: async () => (await api.get(`/missions/${id}`)).data,
    enabled: Boolean(id) && enabled,
    staleTime: 10_000,
  });
}

export function useMissionChecklist(missionId: string, enabled = true) {
  return useQuery({
    queryKey: qk.missionChecklist(missionId || ""),
    queryFn: async () =>
      (await api.get(`/missions/${missionId}/checklist`)).data,
    enabled: Boolean(missionId) && enabled,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });
}

export function useMissionChecklistConfig(enabled = true) {
  return useQuery({
    queryKey: qk.missionChecklistConfig,
    queryFn: async () => (await api.get("/missions/checklist/config")).data,
    enabled,
    staleTime: 20_000,
    refetchOnWindowFocus: false,
  });
}

export function useMissionChecklistMapping(
  filters: { localityId?: string; scope?: string },
  enabled = true,
) {
  const normalized = {
    localityId: filters.localityId || undefined,
    scope: filters.scope || "SMIF",
  };
  return useQuery({
    queryKey: qk.missionChecklistMapping(normalized),
    queryFn: async () =>
      (await api.get("/missions/checklist/mapping", { params: normalized }))
        .data,
    enabled,
    staleTime: 20_000,
    refetchOnWindowFocus: false,
  });
}

export function useUpdateMissionChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      payload: {
        omId: string;
        items: Array<{
          id: string;
          classification:
            | "FORTE_CONSOLIDADA"
            | "OPORTUNIDADE_MELHORIA"
            | "NECESSITA_ANALISE"
            | "POSSIVEL_RISCO";
          notes?: string;
          photos?: string[];
        }>;
      };
    }) => (await api.put(`/missions/${args.id}/checklist`, args.payload)).data,
    onSuccess: (_data, args) => {
      qc.invalidateQueries({ queryKey: qk.missionChecklist(args.id) });
      qc.invalidateQueries({ queryKey: qk.missionChecklistConfig });
      qc.invalidateQueries({ queryKey: qk.mission(args.id) });
      qc.invalidateQueries({ queryKey: ["missions"] });
      qc.invalidateQueries({ queryKey: ["missionChecklistMapping"] });
    },
  });
}

export function useUploadMissionChecklistPhoto() {
  return useMutation({
    mutationFn: async (args: { missionId: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", args.file);
      return (
        await api.post(
          `/missions/${args.missionId}/checklist/photos`,
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
          },
        )
      ).data as { photoUrl: string };
    },
  });
}

export function useCreateMissionChecklistDimension() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      sectionId: "lideranca" | "acompanhamento_recrutas" | "analise_riscos";
      title: string;
      prompt?: string;
      sortOrder?: number;
    }) =>
      (await api.post("/missions/checklist/config/dimensions", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.missionChecklistConfig });
      qc.invalidateQueries({ queryKey: ["missionChecklistMapping"] });
      qc.invalidateQueries({ queryKey: ["missions"] });
    },
  });
}

export function useUpdateMissionChecklistDimension() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      payload: {
        sectionId?: "lideranca" | "acompanhamento_recrutas" | "analise_riscos";
        title?: string;
        prompt?: string;
        sortOrder?: number;
      };
    }) =>
      (
        await api.put(
          `/missions/checklist/config/dimensions/${args.id}`,
          args.payload,
        )
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.missionChecklistConfig });
      qc.invalidateQueries({ queryKey: ["missionChecklistMapping"] });
      qc.invalidateQueries({ queryKey: ["missions"] });
    },
  });
}

export function useDeleteMissionChecklistDimension() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/missions/checklist/config/dimensions/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.missionChecklistConfig });
      qc.invalidateQueries({ queryKey: ["missionChecklistMapping"] });
      qc.invalidateQueries({ queryKey: ["missions"] });
    },
  });
}

export function useUpdateMissionChecklistClassification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id:
        | "FORTE_CONSOLIDADA"
        | "OPORTUNIDADE_MELHORIA"
        | "NECESSITA_ANALISE"
        | "POSSIVEL_RISCO";
      payload: {
        label: string;
        colorHex?: string;
      };
    }) =>
      (
        await api.put(
          `/missions/checklist/config/classifications/${args.id}`,
          args.payload,
        )
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.missionChecklistConfig });
      qc.invalidateQueries({ queryKey: ["missionChecklistMapping"] });
      qc.invalidateQueries({ queryKey: ["missions"] });
    },
  });
}

export function useCreateMission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      title: string;
      description?: string | null;
      localityId: string;
      startDate: string;
      endDate: string;
      scope?: "SMIF" | "CIPAVD";
    }) => (await api.post("/missions", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["missions"] });
      qc.invalidateQueries({ queryKey: ["missions", "statistics"] });
    },
  });
}

export function useUpdateMission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      payload: {
        title?: string;
        description?: string | null;
        localityId?: string;
        startDate?: string;
        endDate?: string;
      };
    }) => (await api.put(`/missions/${args.id}`, args.payload)).data,
    onSuccess: (_data, args) => {
      qc.invalidateQueries({ queryKey: ["missions"] });
      qc.invalidateQueries({ queryKey: ["missions", "statistics"] });
      qc.invalidateQueries({ queryKey: qk.mission(args.id) });
    },
  });
}

export function useDeleteMission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/missions/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["missions"] });
      qc.invalidateQueries({ queryKey: ["missions", "statistics"] });
    },
  });
}

export function useLookupMissionLdapParticipant(query: string) {
  return useQuery({
    queryKey: ["missions", "ldap", query],
    queryFn: async () =>
      (await api.get("/missions/ldap-participant", { params: { q: query } }))
        .data,
    enabled: query.trim().length >= 3,
    staleTime: 5_000,
  });
}

export function useAddMissionParticipantFromLdap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; identifier: string }) =>
      (
        await api.post(`/missions/${args.id}/participants/ldap`, {
          identifier: args.identifier,
        })
      ).data,
    onSuccess: (_data, args) => {
      qc.invalidateQueries({ queryKey: ["missions"] });
      qc.invalidateQueries({ queryKey: ["missions", "statistics"] });
      qc.invalidateQueries({ queryKey: qk.mission(args.id) });
    },
  });
}

export function useAddMissionParticipantFromUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; userId: string }) =>
      (
        await api.post(`/missions/${args.id}/participants/user`, {
          userId: args.userId,
        })
      ).data,
    onSuccess: (_data, args) => {
      qc.invalidateQueries({ queryKey: ["missions"] });
      qc.invalidateQueries({ queryKey: ["missions", "statistics"] });
      qc.invalidateQueries({ queryKey: qk.mission(args.id) });
    },
  });
}

export function useRemoveMissionParticipant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; participantId: string }) =>
      (
        await api.delete(
          `/missions/${args.id}/participants/${args.participantId}`,
        )
      ).data,
    onSuccess: (_data, args) => {
      qc.invalidateQueries({ queryKey: ["missions"] });
      qc.invalidateQueries({ queryKey: ["missions", "statistics"] });
      qc.invalidateQueries({ queryKey: qk.mission(args.id) });
    },
  });
}

export function useMissionSchedule(missionId: string) {
  return useQuery({
    queryKey: qk.missionSchedule(missionId || ""),
    queryFn: async () =>
      (await api.get(`/missions/${missionId}/schedule`)).data,
    enabled: Boolean(missionId),
    staleTime: 5_000,
  });
}

export function useCreateMissionScheduleItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      payload: {
        title: string;
        startAt: string;
        durationMinutes: number;
        location: string;
        responsible: string;
        participants: string;
      };
    }) => (await api.post(`/missions/${args.id}/schedule`, args.payload)).data,
    onSuccess: (_data, args) => {
      qc.invalidateQueries({ queryKey: qk.missionSchedule(args.id) });
      qc.invalidateQueries({ queryKey: ["missions"] });
      qc.invalidateQueries({ queryKey: ["missions", "statistics"] });
      qc.invalidateQueries({ queryKey: qk.mission(args.id) });
    },
  });
}

export function useUpdateMissionScheduleItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      itemId: string;
      payload: {
        title?: string;
        startAt?: string;
        durationMinutes?: number;
        location?: string;
        responsible?: string;
        participants?: string;
      };
    }) =>
      (
        await api.put(
          `/missions/${args.id}/schedule/${args.itemId}`,
          args.payload,
        )
      ).data,
    onSuccess: (_data, args) => {
      qc.invalidateQueries({ queryKey: qk.missionSchedule(args.id) });
      qc.invalidateQueries({ queryKey: ["missions"] });
      qc.invalidateQueries({ queryKey: ["missions", "statistics"] });
      qc.invalidateQueries({ queryKey: qk.mission(args.id) });
    },
  });
}

export function useDeleteMissionScheduleItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; itemId: string }) =>
      (await api.delete(`/missions/${args.id}/schedule/${args.itemId}`)).data,
    onSuccess: (_data, args) => {
      qc.invalidateQueries({ queryKey: qk.missionSchedule(args.id) });
      qc.invalidateQueries({ queryKey: ["missions"] });
      qc.invalidateQueries({ queryKey: ["missions", "statistics"] });
      qc.invalidateQueries({ queryKey: qk.mission(args.id) });
    },
  });
}

export function useExportMissionSchedulePdf() {
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.get(`/missions/${id}/schedule/pdf`, {
        responseType: "blob",
      });
      const contentType = String(
        response.headers?.["content-type"] ?? "",
      ).toLowerCase();
      if (!contentType.includes("application/pdf")) {
        throw new Error(
          "Não foi possível exportar o PDF. Faça login novamente e tente de novo.",
        );
      }
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const contentDisposition = String(
        response.headers?.["content-disposition"] ?? "",
      );
      const fileNameMatch =
        /filename\*=(?:UTF-8'')?([^;]+)/i.exec(contentDisposition) ??
        /filename="?([^"]+)"?/i.exec(contentDisposition);
      const decodedName = fileNameMatch?.[1]
        ? decodeURIComponent(fileNameMatch[1].trim())
        : "";
      a.download = decodedName || `cronograma-missao-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Evita que alguns navegadores cancelem o download por revogação imediata.
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      return true;
    },
  });
}

export function useMissionBannerPreview(
  missionId: string,
  bannerId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: qk.missionBannerPreview(missionId || "", bannerId || ""),
    queryFn: async () =>
      (
        await api.get(`/missions/${missionId}/banners/${bannerId}/preview`, {
          responseType: "blob",
        })
      ).data as Blob,
    enabled: Boolean(missionId) && Boolean(bannerId) && enabled,
    staleTime: 5_000,
  });
}

export function useCreateMissionBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      payload: {
        name: string;
        eventDate: string;
        eventTime: string;
        locationPrimary: string;
        locationSecondary?: string | null;
        layoutOverrides?: Record<string, unknown> | null;
      };
    }) => (await api.post(`/missions/${args.id}/banners`, args.payload)).data,
    onSuccess: (_data, args) => {
      qc.invalidateQueries({ queryKey: qk.mission(args.id) });
      qc.invalidateQueries({ queryKey: ["missions"] });
    },
  });
}

export function useUpdateMissionBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      bannerId: string;
      payload: {
        name?: string;
        eventDate?: string;
        eventTime?: string;
        locationPrimary?: string;
        locationSecondary?: string | null;
        layoutOverrides?: Record<string, unknown> | null;
      };
    }) =>
      (
        await api.put(
          `/missions/${args.id}/banners/${args.bannerId}`,
          args.payload,
        )
      ).data,
    onSuccess: (_data, args) => {
      qc.invalidateQueries({ queryKey: qk.mission(args.id) });
      qc.invalidateQueries({
        queryKey: qk.missionBannerPreview(args.id, args.bannerId),
      });
      qc.invalidateQueries({ queryKey: ["missions"] });
    },
  });
}

export function useDeleteMissionBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; bannerId: string }) =>
      (await api.delete(`/missions/${args.id}/banners/${args.bannerId}`)).data,
    onSuccess: (_data, args) => {
      qc.invalidateQueries({ queryKey: qk.mission(args.id) });
      qc.removeQueries({
        queryKey: qk.missionBannerPreview(args.id, args.bannerId),
      });
      qc.invalidateQueries({ queryKey: ["missions"] });
    },
  });
}

export function useDownloadMissionBannerFile() {
  return useMutation({
    mutationFn: async (args: {
      id: string;
      bannerId: string;
      format: "png" | "pdf";
    }) => {
      const response = await api.get(
        `/missions/${args.id}/banners/${args.bannerId}/file`,
        {
          params: { format: args.format },
          responseType: "blob",
        },
      );
      const contentType = String(
        response.headers?.["content-type"] ?? "",
      ).toLowerCase();
      const expected = args.format === "pdf" ? "application/pdf" : "image/png";
      if (!contentType.includes(expected)) {
        throw new Error(
          "Não foi possível baixar o banner. Faça login novamente e tente de novo.",
        );
      }
      const blob = new Blob([response.data], { type: expected });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const contentDisposition = String(
        response.headers?.["content-disposition"] ?? "",
      );
      const fileNameMatch =
        /filename\*=(?:UTF-8'')?([^;]+)/i.exec(contentDisposition) ??
        /filename=\"?([^\"]+)\"?/i.exec(contentDisposition);
      const decodedName = fileNameMatch?.[1]
        ? decodeURIComponent(fileNameMatch[1].trim())
        : "";
      a.download =
        decodedName || `banner-missao-${args.bannerId}.${args.format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      return true;
    },
  });
}

export function useActivityComments(activityId: string) {
  return useQuery({
    queryKey: qk.activityComments(activityId || ""),
    queryFn: async () =>
      (await api.get(`/activities/${activityId}/comments`)).data,
    enabled: Boolean(activityId),
    staleTime: 5_000,
  });
}

export function useAddActivityComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; text: string }) =>
      (await api.post(`/activities/${args.id}/comments`, { text: args.text }))
        .data,
    onSuccess: (_data, args) => {
      qc.invalidateQueries({ queryKey: qk.activityComments(args.id) });
      qc.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

export function useMarkActivityCommentsSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.post(`/activities/${id}/comments/seen`)).data,
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: qk.activityComments(id) });
      qc.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

export function useActivitySchedule(activityId: string) {
  return useQuery({
    queryKey: qk.activitySchedule(activityId || ""),
    queryFn: async () =>
      (await api.get(`/activities/${activityId}/schedule`)).data,
    enabled: Boolean(activityId),
    staleTime: 5_000,
  });
}

export function useCreateActivityScheduleItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      payload: {
        title: string;
        startTime: string;
        durationMinutes: number;
        location: string;
        responsible: string;
        participants: string;
      };
    }) =>
      (await api.post(`/activities/${args.id}/schedule`, args.payload)).data,
    onSuccess: (_data, args) => {
      qc.invalidateQueries({ queryKey: qk.activitySchedule(args.id) });
      qc.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

export function useUpdateActivityScheduleItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      itemId: string;
      payload: {
        title?: string;
        startTime?: string;
        durationMinutes?: number;
        location?: string;
        responsible?: string;
        participants?: string;
      };
    }) =>
      (
        await api.put(
          `/activities/${args.id}/schedule/${args.itemId}`,
          args.payload,
        )
      ).data,
    onSuccess: (_data, args) => {
      qc.invalidateQueries({ queryKey: qk.activitySchedule(args.id) });
      qc.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

export function useDeleteActivityScheduleItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; itemId: string }) =>
      (await api.delete(`/activities/${args.id}/schedule/${args.itemId}`)).data,
    onSuccess: (_data, args) => {
      qc.invalidateQueries({ queryKey: qk.activitySchedule(args.id) });
      qc.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

export function useExportActivitySchedulePdf() {
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.get(`/activities/${id}/schedule/pdf`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cronograma-visita-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return true;
    },
  });
}

export function useCreateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      title: string;
      description?: string | null;
      localityId?: string | null;
      localityIds?: string[];
      activityTypeId?: string | null;
      specialtyId?: string | null;
      specialtyIds?: string[];
      responsibleUserIds?: string[];
      eventDate?: string | null;
      reportRequired?: boolean;
      scope?: "SMIF" | "CIPAVD";
    }) => (await api.post("/activities", payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activities"] }),
  });
}

export function useUpdateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      payload: {
        title?: string;
        description?: string | null;
        localityId?: string | null;
        activityTypeId?: string | null;
        specialtyId?: string | null;
        specialtyIds?: string[];
        responsibleUserIds?: string[];
        eventDate?: string | null;
        reportRequired?: boolean;
      };
    }) => (await api.put(`/activities/${args.id}`, args.payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activities"] }),
  });
}

export function useCreateActivityType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; scope: string }) =>
      (await api.post("/activities/types", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activityTypes"] });
    },
  });
}

export function useDeleteActivityType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; scope: string }) =>
      (
        await api.delete(`/activities/types/${args.id}`, {
          params: { scope: args.scope === "CIPAVD" ? "CIPAVD" : "SMIF" },
        })
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activityTypes"] });
      qc.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

export function useUpdateActivityStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; status: string }) =>
      (await api.put(`/activities/${args.id}/status`, { status: args.status }))
        .data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activities"] }),
  });
}

export function useDeleteActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/activities/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activities"] }),
  });
}

export function useBatchDeleteActivities() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { ids: string[] }) =>
      (await api.post("/activities/batch/delete", args)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activities"] }),
  });
}

export function useReplicateActivities() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      ids: string[];
      targetLocalityIds: string[];
      statusMode?: "RESET" | "KEEP";
      dateMode?: "KEEP" | "CLEAR" | "SET_DATE";
      targetDate?: string | null;
    }) => (await api.post("/activities/batch/replicate", args)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activities"] }),
  });
}

export function useReorderActivities() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) =>
      (await api.put("/activities/batch/reorder", { ids })).data as {
        updated: number;
      },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

export function useBatchUpdateActivityStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { ids: string[]; status: string }) =>
      (await api.put("/activities/batch/status", args)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activities"] }),
  });
}

export function useBatchUpdateActivitySpecialty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      ids: string[];
      specialtyId?: string | null;
      specialtyIds?: string[];
    }) => (await api.put("/activities/batch/specialty", args)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activities"] }),
  });
}

export function useBatchUpdateActivityResponsible() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      ids: string[];
      responsibleUserId: string | null;
    }) => (await api.put("/activities/batch/responsible", args)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activities"] }),
  });
}

export function useUpsertActivityReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      payload: {
        date: string;
        location: string;
        responsible: string;
        activityAnalysis: string;
        activitiesPerformed: string;
        participantsCount: number;
        participantsMaleCount?: number;
        participantsFemaleCount?: number;
        instructorsCount?: number;
        recruitsCount?: number;
        eloPsychologyCount?: number;
        eloSocialAssistanceCount?: number;
        eloJuridicoCount?: number;
        eloCpcaCount?: number;
        eloGraduadoMasterCount?: number;
        participantsCharacteristics: string;
        mainPointsObserved?: string;
        attentionPoints?: string;
        nextSteps?: string;
        referencesAndAttachments?: string;
        conclusion: string;
        city: string;
        closingDate: string;
      };
    }) => (await api.put(`/activities/${args.id}/report`, args.payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activities"] }),
  });
}

export function useSignActivityReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; totpCode: string }) =>
      (
        await api.post(`/activities/${args.id}/report/sign`, {
          totpCode: args.totpCode,
        })
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activities"] }),
  });
}

export function useUploadActivityReportPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; file: File }) => {
      const form = new FormData();
      form.append("file", args.file);
      return (await api.post(`/activities/${args.id}/report/photos`, form))
        .data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activities"] }),
  });
}

export function useDeleteActivityReportPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; photoId: string }) =>
      (await api.delete(`/activities/${args.id}/report/photos/${args.photoId}`))
        .data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activities"] }),
  });
}

export function useExportActivityReportPdf() {
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.get(`/activities/${id}/report/pdf`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio-atividade-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return true;
    },
  });
}

export function useUpdateTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; status: string }) =>
      (
        await api.put(`/task-instances/${args.id}/status`, {
          status: args.status,
        })
      ).data,
    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const snapshots = qc.getQueriesData({ queryKey: ["tasks"] });
      snapshots.forEach(([key, data]: any) => {
        if (!data?.items) return;
        qc.setQueryData(key, {
          ...data,
          items: data.items.map((item: any) =>
            item.id === args.id ? { ...item, status: args.status } : item,
          ),
        });
      });
      return { snapshots };
    },
    onError: (_err, _args, ctx) => {
      ctx?.snapshots?.forEach(([key, data]: any) => qc.setQueryData(key, data));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useUpdateTaskProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; progressPercent: number }) =>
      (
        await api.put(`/task-instances/${args.id}/progress`, {
          progressPercent: args.progressPercent,
        })
      ).data,
    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const snapshots = qc.getQueriesData({ queryKey: ["tasks"] });
      snapshots.forEach(([key, data]: any) => {
        if (!data?.items) return;
        qc.setQueryData(key, {
          ...data,
          items: data.items.map((item: any) =>
            item.id === args.id
              ? { ...item, progressPercent: args.progressPercent }
              : item,
          ),
        });
      });
      return { snapshots };
    },
    onError: (_err, _args, ctx) => {
      ctx?.snapshots?.forEach(([key, data]: any) => qc.setQueryData(key, data));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useAssignTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      assignedToId?: string | null;
      localityId?: string | null;
      assigneeType?:
        | "USER"
        | "ELO"
        | "LOCALITY_COMMAND"
        | "LOCALITY_COMMANDER"
        | null;
      assigneeId?: string | null;
    }) =>
      (
        await api.put(`/task-instances/${args.id}/assign`, {
          assignedToId: args.assignedToId,
          localityId: args.localityId,
          assigneeType: args.assigneeType,
          assigneeId: args.assigneeId,
        })
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useTaskAssignees(localityId: string) {
  return useQuery({
    queryKey: qk.taskAssignees(localityId || ""),
    queryFn: async () =>
      (await api.get("/task-instances/assignees", { params: { localityId } }))
        .data,
    enabled: Boolean(localityId),
    staleTime: 10_000,
  });
}

export function useTaskAssignableUsers(enabled = true) {
  return useQuery({
    queryKey: ["task-assignable-users"],
    queryFn: async () => {
      const data = (await api.get("/task-instances/assignable-users")).data;
      return {
        ...data,
        items: (data?.items ?? []).map((item: any) => ({
          ...item,
          name: toMilitaryDisplayName(item?.name),
        })),
      } as {
        items: Array<{
          id: string;
          name: string;
          localityId?: string | null;
        }>;
      };
    },
    enabled,
    staleTime: 10_000,
  });
}

export function useTaskAssigneesMulti(localityIds: string[]) {
  const normalized = Array.from(
    new Set(
      (localityIds ?? [])
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  ).sort();
  return useQuery({
    queryKey: ["task-assignees-multi", normalized.join(",")],
    queryFn: async () => {
      const responses = await Promise.allSettled(
        normalized.map(async (localityId) =>
          api.get("/task-instances/assignees", {
            params: { localityId },
          }),
        ),
      );
      const merged = new Map<string, { id: string; name: string }>();
      responses.forEach((response) => {
        if (response.status !== "fulfilled") return;
        const items = response.value?.data?.items ?? [];
        items.forEach((item: any) => {
          if (item?.type !== "USER" || !item?.id) return;
          const id = String(item.id);
          if (!merged.has(id)) {
            merged.set(id, {
              id,
              name: String(item.label ?? `Usuário ${id.slice(0, 8)}`),
            });
          }
        });
      });
      return { items: Array.from(merged.values()) };
    },
    enabled: normalized.length > 0,
    staleTime: 10_000,
  });
}

export function useTaskComments(taskId: string) {
  return useQuery({
    queryKey: qk.taskComments(taskId || ""),
    queryFn: async () =>
      (await api.get(`/task-instances/${taskId}/comments`)).data,
    enabled: Boolean(taskId),
    staleTime: 5_000,
  });
}

export function useAddTaskComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; text: string }) =>
      (
        await api.post(`/task-instances/${args.id}/comments`, {
          text: args.text,
        })
      ).data,
    onSuccess: (_data, args) => {
      qc.invalidateQueries({ queryKey: qk.taskComments(args.id) });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["gantt"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

export function useMarkTaskCommentsSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.post(`/task-instances/${id}/comments/seen`)).data,
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: qk.taskComments(id) });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["gantt"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

export function useUpdateTaskMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; meetingId: string | null }) =>
      (
        await api.put(`/task-instances/${args.id}/meeting`, {
          meetingId: args.meetingId,
        })
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["meetings"] });
    },
  });
}

export function useUpdateTaskEloRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; eloRoleId: string | null }) =>
      (
        await api.put(`/task-instances/${args.id}/elo-role`, {
          eloRoleId: args.eloRoleId,
        })
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useUpdateTaskSpecialty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; specialtyId: string | null }) =>
      (
        await api.put(`/task-instances/${args.id}/specialty`, {
          specialtyId: args.specialtyId,
        })
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useUpdateTaskTitle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; title: string }) =>
      (await api.put(`/task-instances/${args.id}/title`, { title: args.title }))
        .data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["gantt"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
      qc.invalidateQueries({ queryKey: ["meetings"] });
    },
  });
}

export function useUpdateTaskLocalities() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      scope?: string;
      localityIds: string[];
      sourceTaskIds?: string[];
    }) =>
      (
        await api.put(`/task-instances/${args.id}/localities`, {
          scope: args.scope,
          localityIds: args.localityIds,
          sourceTaskIds: args.sourceTaskIds ?? [],
        })
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["gantt"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
      qc.invalidateQueries({ queryKey: ["meetings"] });
      qc.invalidateQueries({ queryKey: ["dashboardNational"] });
      qc.invalidateQueries({ queryKey: ["dashboardExecutive"] });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/task-instances/${id}`)).data,
    onMutate: async (id) => {
      const ids = normalizeTaskIds([id]);
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const snapshots = qc.getQueriesData({ queryKey: ["tasks"] });
      const removedPending = takePendingCreatedTasksByIds(ids);
      removeTaskIdsFromTasksQueries(qc, ids);
      return { snapshots, removedPending };
    },
    onError: (_err, _id, ctx) => {
      ctx?.snapshots?.forEach(([key, data]: any) => qc.setQueryData(key, data));
      restorePendingCreatedTasks(ctx?.removedPending);
    },
    onSuccess: (_data, id) => {
      const ids = normalizeTaskIds([id]);
      takePendingCreatedTasksByIds(ids);
      removeTaskIdsFromTasksQueries(qc, ids);
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["gantt"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
      qc.invalidateQueries({ queryKey: ["meetings"] });
      qc.invalidateQueries({ queryKey: ["dashboardNational"] });
      qc.invalidateQueries({ queryKey: ["dashboardExecutive"] });
    },
  });
}

export function usePostos(enabled = true) {
  return useQuery({
    queryKey: qk.postos,
    queryFn: async () => (await api.get("/postos")).data,
    enabled,
    staleTime: 60_000,
  });
}

export function useCreatePosto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      code: string;
      name: string;
      sortOrder?: number;
    }) => (await api.post("/postos", payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.postos }),
  });
}

export function useUpdatePosto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      payload: { code?: string; name?: string; sortOrder?: number };
    }) => (await api.put(`/postos/${args.id}`, args.payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.postos }),
  });
}

export function useDeletePosto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/postos/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.postos }),
  });
}

export function useBatchAssignTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { ids: string[]; assignedToId: string | null }) =>
      (await api.put("/task-instances/batch/assign", args)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useBatchStatusTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { ids: string[]; status: string }) =>
      (await api.put("/task-instances/batch/status", args)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useBatchProgressTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { ids: string[]; progressPercent: number }) =>
      (await api.put("/task-instances/batch/progress", args)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useBatchDeleteTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { ids: string[] }) =>
      (await api.post("/task-instances/batch/delete", args)).data,
    onMutate: async (args) => {
      const ids = normalizeTaskIds(args?.ids ?? []);
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const snapshots = qc.getQueriesData({ queryKey: ["tasks"] });
      const removedPending = takePendingCreatedTasksByIds(ids);
      removeTaskIdsFromTasksQueries(qc, ids);
      return { snapshots, removedPending };
    },
    onError: (_err, _args, ctx) => {
      ctx?.snapshots?.forEach(([key, data]: any) => qc.setQueryData(key, data));
      restorePendingCreatedTasks(ctx?.removedPending);
    },
    onSuccess: (_data, args) => {
      const ids = normalizeTaskIds(args?.ids ?? []);
      takePendingCreatedTasksByIds(ids);
      removeTaskIdsFromTasksQueries(qc, ids);
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["gantt"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
      qc.invalidateQueries({ queryKey: ["meetings"] });
      qc.invalidateQueries({ queryKey: ["dashboardNational"] });
      qc.invalidateQueries({ queryKey: ["dashboardExecutive"] });
    },
  });
}

export function useGantt(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.gantt(filters),
    queryFn: async () =>
      (await api.get("/task-instances/gantt", { params: filters })).data,
  });
}

export function useCalendarYear(year: number, filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.calendarYear(year, filters),
    queryFn: async () =>
      (
        await api.get("/task-instances/calendar", {
          params: { year, ...filters },
        })
      ).data,
  });
}

export function useLocalityProgress(id: string) {
  return useQuery({
    queryKey: qk.localityProgress(id),
    queryFn: async () => (await api.get(`/localities/${id}/progress`)).data,
    staleTime: 15_000,
  });
}

export function useDashboardNational(
  filters: Record<string, any>,
  enabled = true,
) {
  return useQuery({
    queryKey: qk.dashboardNational(filters),
    queryFn: async () =>
      (await api.get(`/dashboard/national`, { params: filters })).data,
    enabled,
    staleTime: 15_000,
  });
}

export function useUpdateDashboardNationalCardSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: "smif-completed" | "smif-field" | "smif-participants";
      payload: {
        title?: string;
        description?: string;
        backgroundColor?: string;
        textColor?: string;
      };
    }) =>
      (await api.put(`/dashboard/national/cards/${args.id}`, args.payload))
        .data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboardNational"] });
    },
  });
}

export function usePhases() {
  return useQuery({
    queryKey: ["phases"],
    queryFn: async () => (await api.get("/phases")).data,
  });
}

export function useUpdatePhase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; displayName: string | null }) =>
      (await api.patch(`/phases/${args.id}`, { displayName: args.displayName }))
        .data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["phases"] }),
  });
}

export function useTaskTemplates() {
  return useQuery({
    queryKey: qk.taskTemplates,
    queryFn: async () => (await api.get("/task-templates")).data,
  });
}

export function useCreateTaskTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) =>
      (await api.post("/task-templates", payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.taskTemplates }),
  });
}

export function useCloneTaskTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.post(`/task-templates/${id}/clone`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.taskTemplates }),
  });
}

export function useDeleteTaskTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/task-templates/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.taskTemplates });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["gantt"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
      qc.invalidateQueries({ queryKey: ["checklists"] });
      qc.invalidateQueries({ queryKey: ["meetings"] });
    },
  });
}

export function useUpdateTaskTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      payload: {
        title?: string;
        description?: string | null;
        phaseId?: string;
        specialtyId?: string | null;
        eloRoleId?: string | null;
        appliesToAllLocalities?: boolean;
        reportRequiredDefault?: boolean;
      };
    }) => (await api.put(`/task-templates/${args.id}`, args.payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.taskTemplates });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["gantt"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
      qc.invalidateQueries({ queryKey: ["meetings"] });
    },
  });
}

export function useGenerateInstances() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; payload: any }) =>
      (
        await api.post(
          `/task-templates/${args.id}/generate-instances`,
          args.payload,
        )
      ).data,
    onSuccess: async (data) => {
      const created = Array.isArray(data?.items) ? data.items : [];
      stashPendingCreatedTasks(created);
      touchTasksQueries(qc);
      await qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useCreateTaskInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      scope?: string;
      title: string;
      description?: string | null;
      phaseId: string;
      dueDate: string;
      priority?: string;
      localityIds: string[];
      assignedToId?: string | null;
      assigneeIds?: string[];
    }) => (await api.post("/task-instances", payload)).data,
    onSuccess: async (data) => {
      const created = Array.isArray(data?.items) ? data.items : [];
      stashPendingCreatedTasks(created);
      touchTasksQueries(qc);
      await qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["gantt"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
      qc.invalidateQueries({ queryKey: ["meetings"] });
      qc.invalidateQueries({ queryKey: ["dashboardNational"] });
      qc.invalidateQueries({ queryKey: ["dashboardExecutive"] });
    },
  });
}

/** RBAC Admin */
export function useRoles() {
  return useQuery({
    queryKey: qk.roles,
    queryFn: async () => (await api.get("/roles")).data,
  });
}

export function useSetRolePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      roleId: string;
      permissions: Array<{ resource: string; action: string; scope: string }>;
    }) =>
      (
        await api.put(`/roles/${args.roleId}/permissions`, {
          permissions: args.permissions,
        })
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.roles });
      qc.invalidateQueries({ queryKey: ["admin", "rbac", "simulate"] });
      qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}

export function usePermissionsCatalog() {
  return useQuery({
    queryKey: qk.permissions,
    queryFn: async () => (await api.get("/permissions")).data,
  });
}

export function useRbacExport() {
  return useQuery({
    queryKey: ["admin", "rbac", "export"],
    queryFn: async () => (await api.get("/admin/rbac/export")).data,
  });
}

export function useRbacImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { payload: any; mode?: "replace" | "merge" }) =>
      (
        await api.post("/admin/rbac/import", args.payload, {
          params: { mode: args.mode ?? "replace" },
        })
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.roles });
      qc.invalidateQueries({ queryKey: ["admin", "rbac", "export"] });
    },
  });
}

export function useUsers(enabled = true) {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const data = (await api.get("/users")).data;
      return {
        ...data,
        items: (data?.items ?? []).map((item: any) => {
          const parsed = splitMilitaryNameAndOm(item?.name);
          return {
            ...item,
            name: toMilitaryDisplayName(item?.name),
            ldapOm: parsed.om,
          };
        }),
      };
    },
    enabled,
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      eloRoleId?: string | null;
      omId?: string | null;
      localityId?: string | null;
      specialtyId?: string | null;
      roleId?: string | null;
      roleIds?: string[];
    }) => {
      const { id, ...payload } = args;
      return (await api.patch(`/users/${id}`, payload)).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useRemoveUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { userId: string; roleId: string }) =>
      (await api.delete(`/users/${args.userId}/roles/${args.roleId}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}

export function useUserModuleAccess(userId?: string) {
  return useQuery({
    queryKey: qk.userModuleAccess(userId ?? ""),
    queryFn: async () =>
      (await api.get(`/admin/rbac/user-module-access/${userId}`)).data,
    enabled: Boolean(userId),
  });
}

export function useUpdateUserModuleAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      userId: string;
      resource: string;
      enabled: boolean;
    }) =>
      (
        await api.put(`/admin/rbac/user-module-access/${args.userId}`, {
          resource: args.resource,
          enabled: args.enabled,
        })
      ).data,
    onSuccess: (_data, args) => {
      qc.invalidateQueries({ queryKey: qk.userModuleAccess(args.userId) });
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}

export function useRbacSimulate(params: { userId?: string; roleId?: string }) {
  return useQuery({
    queryKey: ["admin", "rbac", "simulate", params],
    queryFn: async () =>
      (await api.get("/admin/rbac/simulate", { params })).data,
    enabled: Boolean(params.userId || params.roleId),
  });
}

export function useLookupLdapUser() {
  return useMutation({
    mutationFn: async (identifier: string) =>
      (await api.get("/admin/rbac/ldap-user", { params: { uid: identifier } }))
        .data,
  });
}

export function useUpsertLdapUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      uid: string;
      roleId?: string;
      roleIds?: string[];
      omId?: string | null;
      localityId?: string | null;
      specialtyId?: string | null;
      eloRoleId?: string | null;
      replaceExistingRoles?: boolean;
    }) => (await api.post("/admin/rbac/ldap-user", args)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}

export function useUploadReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { taskInstanceId: string; file: File }) => {
      const form = new FormData();
      form.append("file", args.file);
      form.append("taskInstanceId", args.taskInstanceId);
      return (await api.post("/reports/upload", form)).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

/** Notices */
export function useNotices(filters: Record<string, any>, enabled = true) {
  return useQuery({
    queryKey: qk.notices(filters),
    queryFn: async () => (await api.get("/notices", { params: filters })).data,
    enabled,
    staleTime: 10_000,
  });
}

export function useCreateNotice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) =>
      (await api.post("/notices", payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notices"] }),
  });
}

export function useUpdateNotice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; payload: any }) =>
      (await api.put(`/notices/${args.id}`, args.payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notices"] }),
  });
}

export function useDeleteNotice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/notices/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notices"] }),
  });
}

export function usePinNotice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; pinned: boolean }) =>
      (await api.patch(`/notices/${args.id}/pin`, { pinned: args.pinned }))
        .data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notices"] }),
  });
}

/** Social communication */
export function useSocialCommunication(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.socialCommunication(filters),
    queryFn: async () =>
      (await api.get("/social-communication", { params: filters })).data,
    staleTime: 10_000,
  });
}

export function useSocialCommunicationHighlights(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.socialCommunicationHighlights(filters),
    queryFn: async () =>
      (await api.get("/social-communication/highlights", { params: filters }))
        .data,
    staleTime: 10_000,
  });
}

export function useLookupSocialCommunicationHighlightLdap() {
  return useMutation({
    mutationFn: async (email: string) =>
      (
        await api.get("/social-communication/highlights/ldap-profile", {
          params: { email },
        })
      ).data,
  });
}

export function useCreateSocialCommunicationHighlight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      ldapUid?: string | null;
      militaryEmail: string;
      militaryName: string;
      highlightRole?: string | null;
      fabom?: string | null;
      photoMimeType?: string | null;
      photoBase64?: string | null;
      impact: "MULTIPLICADOR" | "SIMBOLICO";
      localityId: string;
      text: string;
    }) => (await api.post("/social-communication/highlights", payload)).data,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["socialCommunicationHighlights"] }),
  });
}

export function useUpdateSocialCommunicationHighlight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      payload: {
        ldapUid?: string | null;
        militaryEmail?: string;
        militaryName?: string;
        highlightRole?: string | null;
        fabom?: string | null;
        photoMimeType?: string | null;
        photoBase64?: string | null;
        impact?: "MULTIPLICADOR" | "SIMBOLICO";
        localityId?: string;
        text?: string;
      };
    }) =>
      (
        await api.put(
          `/social-communication/highlights/${args.id}`,
          args.payload,
        )
      ).data,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["socialCommunicationHighlights"] }),
  });
}

export function useDeleteSocialCommunicationHighlight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/social-communication/highlights/${id}`)).data,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["socialCommunicationHighlights"] }),
  });
}

export function useResolveSocialCommunicationMetadata() {
  return useMutation({
    mutationFn: async (url: string) =>
      (await api.post("/social-communication/metadata", { url })).data,
  });
}

export function useUploadSocialCommunicationCover() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return (
        await api.post("/social-communication/upload-cover", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
      ).data as { coverImageUrl: string | null };
    },
  });
}

export function useCreateSocialCommunicationArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      url: string;
      title?: string;
      coverImageUrl?: string | null;
      summary?: string | null;
      contentText?: string | null;
      publishedAt?: string | null;
      tags?: string[];
    }) => (await api.post("/social-communication", payload)).data,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["socialCommunication"] }),
  });
}

export function useUpdateSocialCommunicationArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      payload: {
        url?: string;
        title?: string;
        coverImageUrl?: string | null;
        summary?: string | null;
        contentText?: string | null;
        publishedAt?: string | null;
        tags?: string[];
      };
    }) =>
      (await api.put(`/social-communication/${args.id}`, args.payload)).data,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["socialCommunication"] }),
  });
}

export function useDeleteSocialCommunicationArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/social-communication/${id}`)).data,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["socialCommunication"] }),
  });
}

/** Best practices */
export function useBestPractices(filters: Record<string, any>, enabled = true) {
  return useQuery({
    queryKey: qk.bestPractices(filters),
    queryFn: async () =>
      (await api.get("/best-practices", { params: filters })).data,
    enabled,
    staleTime: 10_000,
  });
}

export function useLessonsLearned(
  filters: Record<string, any>,
  enabled = true,
) {
  return useQuery({
    queryKey: qk.lessonsLearned(filters),
    queryFn: async () =>
      (await api.get("/lessons-learned", { params: filters })).data,
    enabled,
    staleTime: 10_000,
  });
}

export function useLessonLearnedTypes(enabled = true) {
  return useQuery({
    queryKey: qk.lessonLearnedTypes,
    queryFn: async () => (await api.get("/lessons-learned/types")).data,
    enabled,
    staleTime: 10_000,
  });
}

export function useCreateBestPractice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      title: string;
      content: string;
      localityId?: string | null;
      isCommission?: boolean;
    }) => (await api.post("/best-practices", payload)).data,
    onSuccess: () =>
      qc.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "bestPractices",
      }),
  });
}

export function useUpdateBestPractice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      payload: {
        title?: string;
        content?: string;
        localityId?: string | null;
        isCommission?: boolean;
      };
    }) => (await api.put(`/best-practices/${args.id}`, args.payload)).data,
    onSuccess: () =>
      qc.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "bestPractices",
      }),
  });
}

export function useDeleteBestPractice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/best-practices/${id}`)).data,
    onSuccess: () =>
      qc.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "bestPractices",
      }),
  });
}

export function useBestPracticeTypes(enabled = true) {
  return useQuery({
    queryKey: ["bestPracticeTypes"],
    queryFn: async () => (await api.get("/best-practices/types")).data,
    enabled,
    staleTime: 10_000,
  });
}

export function useCreateBestPracticeType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      colorHex: string;
      textColorHex?: string;
    }) => (await api.post("/best-practices/types", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bestPracticeTypes"] });
      qc.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "bestPractices",
      });
    },
  });
}

export function useUpdateBestPracticeType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      payload: { name?: string; colorHex?: string; textColorHex?: string };
    }) =>
      (await api.put(`/best-practices/types/${args.id}`, args.payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bestPracticeTypes"] });
      qc.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "bestPractices",
      });
    },
  });
}

export function useDeleteBestPracticeType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/best-practices/types/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bestPracticeTypes"] });
      qc.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "bestPractices",
      });
    },
  });
}

export function useCreateLessonLearned() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      title: string;
      content: string;
      typeId: string;
    }) => (await api.post("/lessons-learned", payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lessonsLearned"] }),
  });
}

export function useUpdateLessonLearned() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      payload: {
        title?: string;
        content?: string;
        typeId?: string;
      };
    }) => (await api.put(`/lessons-learned/${args.id}`, args.payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lessonsLearned"] }),
  });
}

export function useDeleteLessonLearned() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/lessons-learned/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lessonsLearned"] }),
  });
}

export function useCreateLessonLearnedType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      colorHex: string;
      textColorHex?: string;
    }) => (await api.post("/lessons-learned/types", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lessonLearnedTypes"] });
      qc.invalidateQueries({ queryKey: ["lessonsLearned"] });
    },
  });
}

export function useUpdateLessonLearnedType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      payload: { name?: string; colorHex?: string; textColorHex?: string };
    }) =>
      (await api.put(`/lessons-learned/types/${args.id}`, args.payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lessonLearnedTypes"] });
      qc.invalidateQueries({ queryKey: ["lessonsLearned"] });
    },
  });
}

export function useDeleteLessonLearnedType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/lessons-learned/types/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lessonLearnedTypes"] });
      qc.invalidateQueries({ queryKey: ["lessonsLearned"] });
    },
  });
}

/** Library */
export function useLibrary(filters: Record<string, any> = {}) {
  return useQuery({
    queryKey: qk.library(filters),
    queryFn: async () => (await api.get("/library", { params: filters })).data,
    staleTime: 10_000,
  });
}

export function useUpdateLibrarySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { carouselIntervalSeconds: number }) =>
      (await api.put("/library/settings", payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["library"] }),
  });
}

export function useUploadLibraryPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      file: File;
      title?: string;
      localityId?: string;
      scope?: "SMIF" | "CIPAVD";
    }) => {
      const formData = new FormData();
      formData.append("file", args.file);
      if (args.title) formData.append("title", args.title);
      if (args.localityId) formData.append("localityId", args.localityId);
      if (args.scope) formData.append("scope", args.scope);
      return (
        await api.post("/library/photos/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
      ).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["library"] }),
  });
}

export function useUpdateLibraryPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      payload: {
        title?: string;
        sortOrder?: number;
        localityId?: string | null;
        scope?: "SMIF" | "CIPAVD";
      };
    }) => (await api.put(`/library/photos/${args.id}`, args.payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["library"] }),
  });
}

export function useDeleteLibraryPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/library/photos/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["library"] }),
  });
}

export function useUploadLibraryDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      file: File;
      title?: string;
      scope?: "SMIF" | "CIPAVD";
    }) => {
      const formData = new FormData();
      formData.append("file", args.file);
      if (args.title) formData.append("title", args.title);
      if (args.scope) formData.append("scope", args.scope);
      return (
        await api.post("/library/documents/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
      ).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["library"] }),
  });
}

export function useUpdateLibraryDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; payload: { title?: string } }) =>
      (await api.put(`/library/documents/${args.id}`, args.payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["library"] }),
  });
}

export function useDeleteLibraryDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/library/documents/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["library"] }),
  });
}

/** Meetings */
export function useMeetings(filters: Record<string, any>, enabled = true) {
  return useQuery({
    queryKey: qk.meetings(filters),
    queryFn: async () => (await api.get("/meetings", { params: filters })).data,
    enabled,
    staleTime: 10_000,
  });
}

export function useCreateMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) =>
      (await api.post("/meetings", payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meetings"] }),
  });
}

export function useUpdateMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; payload: any }) =>
      (await api.put(`/meetings/${args.id}`, args.payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meetings"] }),
  });
}

export function useDeleteMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/meetings/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["gantt"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

export function useAddMeetingDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; text: string }) =>
      (await api.post(`/meetings/${args.id}/decisions`, { text: args.text }))
        .data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meetings"] }),
  });
}

export function useGenerateMeetingTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; payload: any }) =>
      (await api.post(`/meetings/${args.id}/generate-tasks`, args.payload))
        .data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meetings"] }),
  });
}

/** Checklists */
export function useChecklists(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.checklists(filters),
    queryFn: async () =>
      (await api.get("/checklists", { params: filters })).data,
    staleTime: 10_000,
  });
}

export function useCreateChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) =>
      (await api.post("/checklists", payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklists"] }),
  });
}

export function useAddChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; payload: any }) =>
      (await api.post(`/checklists/${args.id}/items`, args.payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklists"] }),
  });
}

export function useUpdateChecklistStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { updates: any[] }) =>
      (await api.put("/checklist-item-status/batch", payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklists"] }),
  });
}

/** Elos + Org Chart */
export function useElos(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.elos(filters),
    queryFn: async () => (await api.get("/elos", { params: filters })).data,
    staleTime: 10_000,
  });
}

export function useCreateElo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => (await api.post("/elos", payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["elos"] }),
  });
}

export function useUpdateElo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; payload: any }) =>
      (await api.put(`/elos/${args.id}`, args.payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["elos"] }),
  });
}

export function useDeleteElo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/elos/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["elos"] }),
  });
}

export function useOrgChart(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.orgChart(filters),
    queryFn: async () =>
      (await api.get("/org-chart", { params: filters })).data,
    staleTime: 15_000,
  });
}

export function useOrgChartCommissionMembers(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.orgChartCommissionMembers(filters),
    queryFn: async () => {
      const data = (
        await api.get("/org-chart/commission-members", { params: filters })
      ).data;
      return {
        ...data,
        items: (data?.items ?? []).map((item: any) => ({
          ...item,
          name: toMilitaryDisplayName(item?.name),
          warName: toMilitaryDisplayName(item?.warName ?? item?.name),
        })),
      };
    },
    staleTime: 15_000,
  });
}

export function useOrgChartCommissionCandidates(
  filters: Record<string, any>,
  enabled = true,
) {
  return useQuery({
    queryKey: qk.orgChartCommissionCandidates(filters),
    queryFn: async () => {
      const data = (
        await api.get("/org-chart/commission-candidates", { params: filters })
      ).data;
      return {
        ...data,
        items: (data?.items ?? []).map((item: any) => ({
          ...item,
          name: toMilitaryDisplayName(item?.name),
          warName: toMilitaryDisplayName(item?.warName ?? item?.name),
        })),
      };
    },
    enabled,
    staleTime: 10_000,
  });
}

export function useOrgChartCandidates(
  filters: Record<string, any>,
  enabled = true,
) {
  return useQuery({
    queryKey: ["orgChart", "candidates", filters],
    queryFn: async () => {
      const data = (await api.get("/org-chart/candidates", { params: filters }))
        .data;
      return {
        ...data,
        items: (data?.items ?? []).map((item: any) => ({
          ...item,
          name: toMilitaryDisplayName(item?.name),
          warName: toMilitaryDisplayName(item?.warName ?? item?.name),
        })),
      };
    },
    enabled,
    staleTime: 10_000,
  });
}

export function useCreateOrgChartAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      localityId: string;
      eloRoleId: string;
      userId: string;
      rank?: string | null;
      phone?: string | null;
      om?: string | null;
    }) => (await api.post("/org-chart/assignments", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orgChart"] });
      qc.invalidateQueries({ queryKey: ["elos"] });
    },
  });
}

export function useUpdateOrgChartAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      payload: {
        localityId?: string;
        eloRoleId?: string;
        userId?: string;
        rank?: string | null;
        phone?: string | null;
        om?: string | null;
      };
    }) =>
      (await api.put(`/org-chart/assignments/${args.id}`, args.payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orgChart"] });
      qc.invalidateQueries({ queryKey: ["elos"] });
    },
  });
}

export function useDeleteOrgChartAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/org-chart/assignments/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orgChart"] });
      qc.invalidateQueries({ queryKey: ["elos"] });
    },
  });
}

export function useAddOrgChartCommissionMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { userId: string }) =>
      (await api.post("/org-chart/commission-members", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orgChart"] });
      qc.invalidateQueries({ queryKey: ["orgChart", "commissionMembers"] });
      qc.invalidateQueries({ queryKey: ["orgChart", "commissionCandidates"] });
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}

export function useRemoveOrgChartCommissionMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) =>
      (await api.delete(`/org-chart/commission-members/${userId}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orgChart"] });
      qc.invalidateQueries({ queryKey: ["orgChart", "commissionMembers"] });
      qc.invalidateQueries({ queryKey: ["orgChart", "commissionCandidates"] });
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}

export function useUpdateOrgChartCommissionMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      userId: string;
      payload: {
        functionText?: string | null;
        phone?: string | null;
        seniority?: number | null;
      };
    }) =>
      (
        await api.put(
          `/org-chart/commission-members/${args.userId}`,
          args.payload,
        )
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orgChart"] });
      qc.invalidateQueries({ queryKey: ["orgChart", "commissionMembers"] });
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useReorderOrgChartCommissionMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { userIds: string[] }) =>
      (await api.put("/org-chart/commission-members/reorder", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orgChart", "commissionMembers"] });
      qc.invalidateQueries({ queryKey: ["orgChart"] });
    },
  });
}

/** Audit logs */
export function useAuditLogs(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.auditLogs(filters),
    queryFn: async () =>
      (await api.get("/audit-logs", { params: filters })).data,
    staleTime: 10_000,
  });
}

/** Último login LDAP por usuário (eventos auth/login_ldap nos logs). */
export function useAuditLastLogins() {
  return useQuery({
    queryKey: qk.auditLastLogins,
    queryFn: async () =>
      (await api.get("/audit-logs/last-logins")).data as {
        items: Array<{
          userId: string;
          lastLoginAt: string;
          user: {
            id: string;
            name: string | null;
            email: string | null;
            ldapUid: string | null;
          } | null;
        }>;
      },
    staleTime: 30_000,
  });
}

/** Menu updates (novidades por menu) */
export function useMenuUpdates(menuKeys: string[], enabled = true) {
  const normalizedKeys = useMemo(
    () =>
      Array.from(
        new Set(
          (menuKeys ?? [])
            .map((menuKey) => String(menuKey ?? "").trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [menuKeys],
  );

  return useQuery({
    queryKey: qk.menuUpdates(normalizedKeys),
    queryFn: async () =>
      (
        await api.get("/menu-updates", {
          params: {
            menuKeys: normalizedKeys.join(","),
          },
        })
      ).data as {
        items: Array<{
          menuKey: string;
          unreadCount: number;
          hasUnread: boolean;
          lastEventAt: string | null;
          seenAt: string | null;
        }>;
      },
    enabled: enabled && normalizedKeys.length > 0,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

function patchMenuUpdatesData(data: unknown, menuKey: string, seenAt: string) {
  if (!data || typeof data !== "object") return data;
  const current = data as {
    items?: Array<{
      menuKey?: string | null;
      unreadCount?: number;
      hasUnread?: boolean;
      seenAt?: string | null;
      lastEventAt?: string | null;
    }>;
  };
  if (!Array.isArray(current.items)) return data;

  let changed = false;
  const items = current.items.map((item) => {
    if (String(item?.menuKey ?? "").trim() !== menuKey) return item;
    changed = true;
    return {
      ...item,
      unreadCount: 0,
      hasUnread: false,
      seenAt,
    };
  });

  if (!changed) return data;
  return {
    ...current,
    items,
  };
}

export function useMarkMenuUpdateSeen() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (menuKey: string) =>
      (await api.post(`/menu-updates/${encodeURIComponent(menuKey)}/seen`))
        .data as {
        ok: boolean;
        menuKey: string;
        seenAt: string;
      },
    onMutate: async (menuKeyRaw: string) => {
      const menuKey = String(menuKeyRaw ?? "").trim();
      if (!menuKey)
        return { snapshots: [] as Array<[readonly unknown[], any]> };

      await qc.cancelQueries({ queryKey: ["menuUpdates"] });
      const snapshots = qc.getQueriesData({ queryKey: ["menuUpdates"] });
      const seenAt = new Date().toISOString();

      for (const [queryKey, oldData] of snapshots) {
        qc.setQueryData(
          queryKey,
          patchMenuUpdatesData(oldData, menuKey, seenAt),
        );
      }

      return { snapshots };
    },
    onError: (_error, _menuKey, context) => {
      for (const [queryKey, data] of context?.snapshots ?? []) {
        qc.setQueryData(queryKey, data);
      }
    },
    onSuccess: (data) => {
      const menuKey = String(data?.menuKey ?? "").trim();
      const seenAt = String(data?.seenAt ?? "").trim();
      if (!menuKey || !seenAt) return;
      qc.setQueriesData({ queryKey: ["menuUpdates"] }, (oldData) =>
        patchMenuUpdatesData(oldData, menuKey, seenAt),
      );
    },
  });
}

/** CPCA cases */
export function useCpcaCases(filters: Record<string, any>, enabled = true) {
  return useQuery({
    queryKey: qk.cpcaCases(filters),
    queryFn: async () =>
      (await api.get("/cpca-cases", { params: filters })).data,
    enabled,
    staleTime: 10_000,
  });
}

export function useCpcaCaseLocalityOptions(enabled = true) {
  return useQuery({
    queryKey: qk.cpcaCaseLocalityOptions(),
    queryFn: async () => (await api.get("/cpca-cases/locality-options")).data,
    enabled,
    staleTime: 60_000,
  });
}

export function useCpcaCase(id: string, enabled = true) {
  return useQuery({
    queryKey: qk.cpcaCase(id || ""),
    queryFn: async () => (await api.get(`/cpca-cases/${id}`)).data,
    enabled: Boolean(id) && enabled,
    staleTime: 10_000,
  });
}

export function useCpcaCasePendingSummary(
  filters: Record<string, any>,
  enabled = true,
) {
  return useQuery({
    queryKey: qk.cpcaCasePendingSummary(filters),
    queryFn: async () =>
      (await api.get("/cpca-cases/cipavd-pending-summary", { params: filters }))
        .data,
    enabled,
    staleTime: 10_000,
  });
}

export function useCpcaCaseStats(filters: Record<string, any>, enabled = true) {
  return useQuery({
    queryKey: qk.cpcaCaseStats(filters),
    queryFn: async () =>
      (await api.get("/cpca-cases/stats", { params: filters })).data,
    enabled,
    staleTime: 15_000,
  });
}

export function useCreateCpcaCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, any>) =>
      (await api.post("/cpca-cases", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cpcaCases"] });
    },
  });
}

export function useUpdateCpcaCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; payload: Record<string, any> }) =>
      (await api.put(`/cpca-cases/${args.id}`, args.payload)).data,
    onSuccess: (_data, args) => {
      qc.invalidateQueries({ queryKey: ["cpcaCases"] });
      qc.invalidateQueries({ queryKey: qk.cpcaCase(args.id) });
    },
  });
}

export function useDeleteCpcaCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/cpca-cases/${id}`)).data,
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["cpcaCases"] });
      qc.invalidateQueries({ queryKey: qk.cpcaCase(id) });
    },
  });
}

export function useAddCpcaCaseComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; text: string }) =>
      (await api.post(`/cpca-cases/${args.id}/comments`, { text: args.text }))
        .data,
    onSuccess: (_data, args) => {
      qc.invalidateQueries({ queryKey: ["cpcaCases"] });
      qc.invalidateQueries({ queryKey: qk.cpcaCase(args.id) });
    },
  });
}

export function useCreateCpcaCaseCipavdThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      text: string;
      isPending?: boolean;
    }) =>
      (
        await api.post(`/cpca-cases/${args.id}/cipavd-threads`, {
          text: args.text,
          isPending: args.isPending,
        })
      ).data,
    onSuccess: (_data, args) => {
      qc.invalidateQueries({ queryKey: ["cpcaCases"] });
      qc.invalidateQueries({ queryKey: qk.cpcaCase(args.id) });
      qc.invalidateQueries({ queryKey: ["cpcaCasePendingSummary"] });
      qc.invalidateQueries({ queryKey: ["menuUpdates"] });
    },
  });
}

export function useResolveCpcaCaseCipavdThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; threadId: string; text: string }) =>
      (
        await api.post(
          `/cpca-cases/${args.id}/cipavd-threads/${args.threadId}/resolve`,
          { text: args.text },
        )
      ).data,
    onSuccess: (_data, args) => {
      qc.invalidateQueries({ queryKey: ["cpcaCases"] });
      qc.invalidateQueries({ queryKey: qk.cpcaCase(args.id) });
      qc.invalidateQueries({ queryKey: ["cpcaCasePendingSummary"] });
      qc.invalidateQueries({ queryKey: ["cpcaCommission"] });
      qc.invalidateQueries({ queryKey: ["menuUpdates"] });
    },
  });
}

export function useReopenCpcaCaseCipavdThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; threadId: string; text: string }) =>
      (
        await api.post(
          `/cpca-cases/${args.id}/cipavd-threads/${args.threadId}/reopen`,
          { text: args.text },
        )
      ).data,
    onSuccess: (_data, args) => {
      qc.invalidateQueries({ queryKey: ["cpcaCases"] });
      qc.invalidateQueries({ queryKey: qk.cpcaCase(args.id) });
      qc.invalidateQueries({ queryKey: ["cpcaCasePendingSummary"] });
      qc.invalidateQueries({ queryKey: ["cpcaCommission"] });
      qc.invalidateQueries({ queryKey: ["menuUpdates"] });
    },
  });
}

export function useFinalizeCpcaCaseCipavdThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; threadId: string }) =>
      (
        await api.post(
          `/cpca-cases/${args.id}/cipavd-threads/${args.threadId}/finalize`,
        )
      ).data,
    onSuccess: (_data, args) => {
      qc.invalidateQueries({ queryKey: ["cpcaCases"] });
      qc.invalidateQueries({ queryKey: qk.cpcaCase(args.id) });
      qc.invalidateQueries({ queryKey: ["cpcaCasePendingSummary"] });
      qc.invalidateQueries({ queryKey: ["cpcaCommission"] });
      qc.invalidateQueries({ queryKey: ["menuUpdates"] });
    },
  });
}

/** CPCA commission (presidente + membros + homologações) */
export function useCpcaCommissionOverview(
  localityId: string | undefined,
  enabled = true,
) {
  const normalizedLocalityId = String(localityId ?? "").trim();
  return useQuery({
    queryKey: qk.cpcaCommissionOverview(normalizedLocalityId),
    queryFn: async () =>
      (
        await api.get("/cpca-commission/overview", {
          params: normalizedLocalityId
            ? { localityId: normalizedLocalityId }
            : undefined,
        })
      ).data,
    enabled,
    staleTime: 10_000,
  });
}

export function useCpcaChecklistLocality(
  localityId: string | undefined,
  enabled = true,
) {
  const normalizedLocalityId = String(localityId ?? "").trim();
  return useQuery({
    queryKey: qk.cpcaChecklistLocality(normalizedLocalityId),
    queryFn: async () =>
      (
        await api.get("/cpca-checklist/locality", {
          params: normalizedLocalityId
            ? { localityId: normalizedLocalityId }
            : undefined,
        })
      ).data,
    enabled,
    staleTime: 10_000,
  });
}

export function useUpdateCpcaChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      localityId?: string;
      items: Array<{
        itemKey: string;
        isCompleted: boolean;
        completedAt?: string | null;
        details?: string | null;
        speakerName?: string | null;
      }>;
    }) => (await api.put("/cpca-checklist/locality", payload)).data,
    onSuccess: (_data, payload) => {
      qc.invalidateQueries({ queryKey: ["cpcaCommission"] });
      qc.invalidateQueries({ queryKey: ["cpcaChecklist"] });
      const localityId = String(payload.localityId ?? "").trim();
      if (localityId) {
        qc.invalidateQueries({
          queryKey: qk.cpcaChecklistLocality(localityId),
        });
      }
      qc.invalidateQueries({
        queryKey: ["cpcaChecklist", "national"],
        exact: false,
      });
    },
  });
}

export function useCpcaChecklistNational(
  filters: Record<string, any>,
  enabled = true,
) {
  return useQuery({
    queryKey: qk.cpcaChecklistNational(filters),
    queryFn: async () =>
      (await api.get("/cpca-checklist/national", { params: filters })).data,
    enabled,
    staleTime: 10_000,
  });
}

export function useAssignCpcaPresident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      identifier: string;
      localityId: string;
      isSubstitution?: boolean;
      proceedWithExistingPresident?: boolean;
      designationBulletin?: string;
    }) => (await api.post("/cpca-commission/presidents", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cpcaCommission"] });
      qc.invalidateQueries({
        queryKey: qk.cpcaPresidentRequestsPendingCount(),
      });
      qc.invalidateQueries({
        queryKey: ["cpcaCommission", "presidentRequests"],
      });
      qc.invalidateQueries({ queryKey: ["menuUpdates"] });
      qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}

export function useLookupCpcaPresidentCandidate() {
  return useMutation({
    mutationFn: async (payload: { identifier: string }) =>
      (await api.post("/cpca-commission/presidents/lookup", payload)).data,
  });
}

export function useAddCpcaCommissionMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { identifier: string; localityId?: string }) =>
      (await api.post("/cpca-commission/members", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cpcaCommission"] });
      qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}

export function useUpdateCpcaCommissionCoverage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      localityId: string;
      managedLocalityIds: string[];
    }) => (await api.put("/cpca-commission/coverage", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cpcaCommission"] });
      qc.invalidateQueries({ queryKey: ["cpcaCases", "localityOptions"] });
      qc.invalidateQueries({
        queryKey: qk.cpcaPresidentRequestsPendingCount(),
      });
      qc.invalidateQueries({
        queryKey: ["cpcaCommission", "presidentRequests"],
      });
      qc.invalidateQueries({ queryKey: ["menuUpdates"] });
      qc.invalidateQueries({ queryKey: qk.oms });
      qc.invalidateQueries({ queryKey: qk.omsCatalog });
    },
  });
}

export function useRemoveCpcaCommissionMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) =>
      (await api.delete(`/cpca-commission/members/${memberId}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cpcaCommission"] });
      qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}

export function useCpcaPresidentRequests(
  filters: Record<string, any>,
  enabled = true,
) {
  return useQuery({
    queryKey: qk.cpcaPresidentRequests(filters),
    queryFn: async () =>
      (
        await api.get("/cpca-commission/approval-requests", {
          params: filters,
        })
      ).data,
    enabled,
    staleTime: 10_000,
  });
}

export function useCpcaPresidentRequestsPendingCount(enabled = true) {
  return useQuery({
    queryKey: qk.cpcaPresidentRequestsPendingCount(),
    queryFn: async () => {
      const response = await api.get(
        "/cpca-commission/approval-requests/pending-count",
      );
      return response.data as { pendingCount: number };
    },
    enabled,
    staleTime: 10_000,
  });
}

export function useApproveCpcaPresidentRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      type: string;
      id: string;
      proceedWithExistingPresident?: boolean;
    }) =>
      (
        await api.post(
          `/cpca-commission/approval-requests/${args.type}/${args.id}/approve`,
          { proceedWithExistingPresident: args.proceedWithExistingPresident },
        )
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cpcaCommission"] });
      qc.invalidateQueries({
        queryKey: qk.cpcaPresidentRequestsPendingCount(),
      });
      qc.invalidateQueries({
        queryKey: ["cpcaCommission", "presidentRequests"],
      });
      qc.invalidateQueries({ queryKey: ["menuUpdates"] });
      qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}

export function useRejectCpcaPresidentRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { type: string; id: string; notes?: string }) =>
      (
        await api.post(
          `/cpca-commission/approval-requests/${args.type}/${args.id}/reject`,
          { notes: args.notes },
        )
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cpcaCommission"] });
      qc.invalidateQueries({
        queryKey: qk.cpcaPresidentRequestsPendingCount(),
      });
      qc.invalidateQueries({
        queryKey: ["cpcaCommission", "presidentRequests"],
      });
      qc.invalidateQueries({ queryKey: ["menuUpdates"] });
    },
  });
}

export function useCreateCpcaPresidentNominationRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      identifier: string;
      localityId?: string;
      isSubstitution?: boolean;
      bulletinNumber?: string;
    }) =>
      (await api.post("/cpca-commission/president-nominations", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cpcaCommission"] });
      qc.invalidateQueries({
        queryKey: qk.cpcaPresidentRequestsPendingCount(),
      });
      qc.invalidateQueries({
        queryKey: ["cpcaCommission", "presidentRequests"],
      });
      qc.invalidateQueries({ queryKey: ["menuUpdates"] });
    },
  });
}

export function useCpcaSelfRegistrationLocalities(enabled = true) {
  return useQuery({
    queryKey: qk.cpcaSelfRegistrationLocalities(),
    queryFn: async () =>
      (await api.get("/cpca-commission/self-registration/localities")).data,
    enabled,
    staleTime: 60_000,
  });
}

export function useLookupCpcaSelfRegistrationCandidate() {
  return useMutation({
    mutationFn: async (payload: { identifier: string }) =>
      (await api.post("/cpca-commission/self-registration/lookup", payload))
        .data,
  });
}

export function useCreateCpcaPresidentSelfRegistration() {
  return useMutation({
    mutationFn: async (payload: {
      identifier: string;
      localityId: string;
      isSubstitution: boolean;
      bulletinNumber: string;
    }) => (await api.post("/cpca-commission/self-registration", payload)).data,
  });
}

/** SMIF complaints (full workflow parity with CPCA) */
export function useSmifComplaintCases(
  filters: Record<string, any>,
  enabled = true,
) {
  return useQuery({
    queryKey: qk.smifComplaints(filters),
    queryFn: async () =>
      (await api.get("/smif-complaints", { params: filters })).data,
    enabled,
    staleTime: 10_000,
  });
}

export function useSmifComplaintCase(id: string, enabled = true) {
  return useQuery({
    queryKey: qk.smifComplaintCase(id || ""),
    queryFn: async () => (await api.get(`/smif-complaints/${id}`)).data,
    enabled: Boolean(id) && enabled,
    staleTime: 10_000,
  });
}

export function useSmifComplaintPendingSummary(
  filters: Record<string, any>,
  enabled = true,
) {
  return useQuery({
    queryKey: qk.smifComplaintPendingSummary(filters),
    queryFn: async () =>
      (
        await api.get("/smif-complaints/cipavd-pending-summary", {
          params: filters,
        })
      ).data,
    enabled,
    staleTime: 10_000,
  });
}

export function useCreateSmifComplaintCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, any>) =>
      (await api.post("/smif-complaints", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["smifComplaints"] });
    },
  });
}

export function useUpdateSmifComplaintCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; payload: Record<string, any> }) =>
      (await api.put(`/smif-complaints/${args.id}`, args.payload)).data,
    onSuccess: (_data, args) => {
      qc.invalidateQueries({ queryKey: ["smifComplaints"] });
      qc.invalidateQueries({ queryKey: qk.smifComplaintCase(args.id) });
    },
  });
}

export function useDeleteSmifComplaintCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/smif-complaints/${id}`)).data,
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["smifComplaints"] });
      qc.invalidateQueries({ queryKey: qk.smifComplaintCase(id) });
    },
  });
}

export function useAddSmifComplaintCaseComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; text: string }) =>
      (
        await api.post(`/smif-complaints/${args.id}/comments`, {
          text: args.text,
        })
      ).data,
    onSuccess: (_data, args) => {
      qc.invalidateQueries({ queryKey: ["smifComplaints"] });
      qc.invalidateQueries({ queryKey: qk.smifComplaintCase(args.id) });
    },
  });
}

export function useCreateSmifComplaintCaseCipavdThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      text: string;
      isPending?: boolean;
    }) =>
      (
        await api.post(`/smif-complaints/${args.id}/cipavd-threads`, {
          text: args.text,
          isPending: args.isPending,
        })
      ).data,
    onSuccess: (_data, args) => {
      qc.invalidateQueries({ queryKey: ["smifComplaints"] });
      qc.invalidateQueries({ queryKey: qk.smifComplaintCase(args.id) });
      qc.invalidateQueries({ queryKey: ["smifComplaintPendingSummary"] });
      qc.invalidateQueries({ queryKey: ["menuUpdates"] });
    },
  });
}

export function useResolveSmifComplaintCaseCipavdThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; threadId: string; text: string }) =>
      (
        await api.post(
          `/smif-complaints/${args.id}/cipavd-threads/${args.threadId}/resolve`,
          { text: args.text },
        )
      ).data,
    onSuccess: (_data, args) => {
      qc.invalidateQueries({ queryKey: ["smifComplaints"] });
      qc.invalidateQueries({ queryKey: qk.smifComplaintCase(args.id) });
      qc.invalidateQueries({ queryKey: ["smifComplaintPendingSummary"] });
      qc.invalidateQueries({ queryKey: ["cpcaCommission"] });
      qc.invalidateQueries({ queryKey: ["menuUpdates"] });
    },
  });
}

export function useReopenSmifComplaintCaseCipavdThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; threadId: string; text: string }) =>
      (
        await api.post(
          `/smif-complaints/${args.id}/cipavd-threads/${args.threadId}/reopen`,
          { text: args.text },
        )
      ).data,
    onSuccess: (_data, args) => {
      qc.invalidateQueries({ queryKey: ["smifComplaints"] });
      qc.invalidateQueries({ queryKey: qk.smifComplaintCase(args.id) });
      qc.invalidateQueries({ queryKey: ["smifComplaintPendingSummary"] });
      qc.invalidateQueries({ queryKey: ["cpcaCommission"] });
      qc.invalidateQueries({ queryKey: ["menuUpdates"] });
    },
  });
}

export function useFinalizeSmifComplaintCaseCipavdThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; threadId: string }) =>
      (
        await api.post(
          `/smif-complaints/${args.id}/cipavd-threads/${args.threadId}/finalize`,
        )
      ).data,
    onSuccess: (_data, args) => {
      qc.invalidateQueries({ queryKey: ["smifComplaints"] });
      qc.invalidateQueries({ queryKey: qk.smifComplaintCase(args.id) });
      qc.invalidateQueries({ queryKey: ["smifComplaintPendingSummary"] });
      qc.invalidateQueries({ queryKey: ["cpcaCommission"] });
      qc.invalidateQueries({ queryKey: ["menuUpdates"] });
    },
  });
}

/** SMIF complaints */
export function useSmifComplaints(
  filters: Record<string, any>,
  enabled = true,
) {
  return useQuery({
    queryKey: qk.smifComplaints(filters),
    queryFn: async () =>
      (await api.get("/smif-complaints", { params: filters })).data,
    enabled,
    staleTime: 10_000,
  });
}

export function useCreateSmifComplaint() {
  return useCreateSmifComplaintCase();
}

export function useUpdateSmifComplaint() {
  return useUpdateSmifComplaintCase();
}

export function useDeleteSmifComplaint() {
  return useDeleteSmifComplaintCase();
}

export function useLocalities(enabled = true) {
  return useQuery({
    queryKey: qk.localities,
    queryFn: async () => (await api.get("/localities")).data,
    enabled,
    staleTime: 60_000,
  });
}

export function useOms(enabled = true) {
  return useQuery({
    queryKey: qk.oms,
    queryFn: async () => (await api.get("/oms")).data,
    enabled,
    staleTime: 60_000,
  });
}

export function useOmsCatalog(enabled = true) {
  return useQuery({
    queryKey: qk.omsCatalog,
    queryFn: async () => (await api.get("/oms/catalog")).data,
    enabled,
    staleTime: 60_000,
  });
}

export function useCipavdLocalities(enabled = true) {
  return useQuery({
    queryKey: qk.cipavdLocalities,
    queryFn: async () => (await api.get("/localities/cipavd")).data,
    enabled,
    staleTime: 60_000,
  });
}

export function useCipavdLocalitiesCatalog(enabled = true) {
  return useQuery({
    queryKey: qk.cipavdLocalitiesCatalog,
    queryFn: async () => (await api.get("/localities/cipavd-catalog")).data,
    enabled,
    staleTime: 60_000,
  });
}

export function useLocalityRecruitDesignations(
  localityId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: qk.recruitDesignations(localityId || ""),
    queryFn: async () =>
      (await api.get(`/localities/${localityId}/recruit-designations`)).data,
    enabled: Boolean(localityId) && enabled,
    staleTime: 10_000,
  });
}

export function useLocalityRecruitMembers(localityId: string, enabled = true) {
  return useQuery({
    queryKey: ["localities", "recruitMembers", localityId || ""],
    queryFn: async () =>
      (await api.get(`/localities/${localityId}/recruits-members`)).data,
    enabled: Boolean(localityId) && enabled,
    staleTime: 10_000,
  });
}

export function useEloRoles() {
  return useQuery({
    queryKey: qk.eloRoles,
    queryFn: async () => (await api.get("/elo-roles")).data,
    staleTime: 60_000,
  });
}

export function useCreateEloRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      code: string;
      name: string;
      sortOrder?: number;
    }) => (await api.post("/elo-roles", payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.eloRoles }),
  });
}

export function useUpdateEloRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      payload: { code?: string; name?: string; sortOrder?: number };
    }) => (await api.put(`/elo-roles/${args.id}`, args.payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.eloRoles });
      qc.invalidateQueries({ queryKey: ["elos"] });
    },
  });
}

export function useDeleteEloRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/elo-roles/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.eloRoles });
      qc.invalidateQueries({ queryKey: ["elos"] });
    },
  });
}

export function useUpdateLocality() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; payload: Record<string, any> }) =>
      (await api.put(`/localities/${args.id}`, args.payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.localities });
      qc.invalidateQueries({ queryKey: ["dashboardRecruits"] });
      qc.invalidateQueries({ queryKey: ["dashboardNational"] });
      qc.invalidateQueries({ queryKey: ["dashboardExecutive"] });
    },
  });
}

export function useUpdateOm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; payload: Record<string, any> }) =>
      (await api.put(`/oms/${args.id}`, args.payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.oms });
      qc.invalidateQueries({ queryKey: qk.omsCatalog });
      qc.invalidateQueries({ queryKey: ["cpcaCommission"] });
      qc.invalidateQueries({ queryKey: ["cpcaCases", "localityOptions"] });
      qc.invalidateQueries({ queryKey: ["dashboardExecutive"] });
    },
  });
}

export function useUpdateLocalitiesHasCpcaBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { ids: string[]; hasCpca: boolean }) =>
      (await api.put("/localities/batch/has-cpca", payload)).data as {
        updatedCount: number;
        hasCpca: boolean;
        ids: string[];
      },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.localities });
      qc.invalidateQueries({ queryKey: ["dashboardRecruits"] });
      qc.invalidateQueries({ queryKey: ["dashboardNational"] });
      qc.invalidateQueries({ queryKey: ["dashboardExecutive"] });
    },
  });
}

export function useUpdateOmsHasCpcaBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { ids: string[]; hasCpca: boolean }) =>
      (await api.put("/oms/batch/has-cpca", payload)).data as {
        updatedCount: number;
        hasCpca: boolean;
        ids: string[];
      },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.oms });
      qc.invalidateQueries({ queryKey: qk.omsCatalog });
      qc.invalidateQueries({ queryKey: ["dashboardExecutive"] });
    },
  });
}

export function useCreateLocality() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, any>) =>
      (await api.post("/localities", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.localities });
      qc.invalidateQueries({ queryKey: ["dashboardRecruits"] });
      qc.invalidateQueries({ queryKey: ["dashboardNational"] });
      qc.invalidateQueries({ queryKey: ["dashboardExecutive"] });
    },
  });
}

export function useCreateOm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, any>) =>
      (await api.post("/oms", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.oms });
      qc.invalidateQueries({ queryKey: qk.omsCatalog });
      qc.invalidateQueries({ queryKey: ["cpcaCommission"] });
      qc.invalidateQueries({ queryKey: ["cpcaCases", "localityOptions"] });
      qc.invalidateQueries({ queryKey: ["dashboardExecutive"] });
    },
  });
}

export function useDeleteLocality() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/localities/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.localities });
      qc.invalidateQueries({ queryKey: ["dashboardRecruits"] });
      qc.invalidateQueries({ queryKey: ["dashboardNational"] });
      qc.invalidateQueries({ queryKey: ["dashboardExecutive"] });
    },
  });
}

export function useDeleteOm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/oms/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.oms });
      qc.invalidateQueries({ queryKey: qk.omsCatalog });
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["cpcaCommission"] });
      qc.invalidateQueries({ queryKey: qk.cpcaCaseLocalityOptions() });
      qc.invalidateQueries({ queryKey: qk.cpcaSelfRegistrationLocalities() });
      qc.invalidateQueries({
        queryKey: qk.cpcaPresidentRequestsPendingCount(),
      });
      qc.invalidateQueries({
        queryKey: ["cpcaCommission", "presidentRequests"],
      });
      qc.invalidateQueries({ queryKey: qk.me });
      qc.invalidateQueries({ queryKey: ["dashboardExecutive"] });
    },
  });
}

export function useCreateCipavdLocality() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { code: string; name: string }) =>
      (await api.post("/localities/cipavd", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.cipavdLocalities });
      qc.invalidateQueries({ queryKey: qk.cipavdLocalitiesCatalog });
      qc.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

export function useUpdateCipavdLocality() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      payload: { code?: string; name?: string };
    }) => (await api.put(`/localities/cipavd/${args.id}`, args.payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.cipavdLocalities });
      qc.invalidateQueries({ queryKey: qk.cipavdLocalitiesCatalog });
      qc.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

export function useDeleteCipavdLocality() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/localities/cipavd/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.cipavdLocalities });
      qc.invalidateQueries({ queryKey: qk.cipavdLocalitiesCatalog });
      qc.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

export function useUpdateLocalityRecruits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      recruitsFemaleCountCurrent: number;
      dismissalReason?: string | null;
    }) =>
      (
        await api.put(`/localities/${args.id}/recruits`, {
          recruitsFemaleCountCurrent: args.recruitsFemaleCountCurrent,
          dismissalReason: args.dismissalReason ?? null,
        })
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.localities });
      qc.invalidateQueries({ queryKey: ["dashboardRecruits"] });
      qc.invalidateQueries({ queryKey: ["dashboardNational"] });
      qc.invalidateQueries({ queryKey: ["dashboardExecutive"] });
    },
  });
}

export function useUpdateLocalityRecruitDesignations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      localityId: string;
      items: Array<{ destinationLocalityId: string; assignedCount: number }>;
    }) =>
      (
        await api.put(`/localities/${args.localityId}/recruit-designations`, {
          items: args.items,
        })
      ).data,
    onSuccess: (_data, args) => {
      qc.invalidateQueries({
        queryKey: qk.recruitDesignations(args.localityId),
      });
      qc.invalidateQueries({ queryKey: ["dashboardRecruits"] });
      qc.invalidateQueries({ queryKey: ["dashboardNational"] });
      qc.invalidateQueries({ queryKey: ["dashboardExecutive"] });
    },
  });
}

export function useReplaceLocalityRecruitMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      localityId: string;
      items: Array<{
        id?: string;
        name: string;
        status:
          | "RECRUITMENT_TO_START"
          | "RECRUITMENT_STARTED"
          | "DISMISSED"
          | "ASSIGNED_TO_OM";
        dismissalReason?: string | null;
        destinationLocalityId?: string | null;
        comment?: string | null;
      }>;
    }) =>
      (
        await api.put(`/localities/${args.localityId}/recruits-members`, {
          items: args.items,
        })
      ).data,
    onSuccess: (_data, args) => {
      qc.invalidateQueries({
        queryKey: ["localities", "recruitMembers", args.localityId],
      });
      qc.invalidateQueries({
        queryKey: qk.recruitDesignations(args.localityId),
      });
      qc.invalidateQueries({ queryKey: qk.localities });
      qc.invalidateQueries({ queryKey: ["dashboardRecruits"] });
      qc.invalidateQueries({ queryKey: ["dashboardNational"] });
      qc.invalidateQueries({ queryKey: ["dashboardExecutive"] });
    },
  });
}

export function useSetLocalityCommanderFromLdap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { localityId: string; uidOrEmail: string }) =>
      (
        await api.put(`/localities/${args.localityId}/commander-from-ldap`, {
          uidOrEmail: args.uidOrEmail,
        })
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.localities });
      qc.invalidateQueries({ queryKey: ["dashboardRecruits"] });
      qc.invalidateQueries({ queryKey: ["dashboardNational"] });
      qc.invalidateQueries({ queryKey: ["dashboardExecutive"] });
    },
  });
}

export function useSpecialties(enabled = true) {
  return useQuery({
    queryKey: qk.specialties,
    queryFn: async () => (await api.get("/specialties")).data,
    staleTime: 60_000,
    enabled,
  });
}

export function useSearch(q: string) {
  return useQuery({
    queryKey: qk.search(q),
    queryFn: async () => (await api.get("/search", { params: { q } })).data,
    enabled: Boolean(q && q.length >= 2),
    staleTime: 5_000,
  });
}

export function useDocuments(filters: Record<string, any>, enabled = true) {
  return useQuery({
    queryKey: qk.documents(filters),
    queryFn: async () =>
      (await api.get("/documents", { params: filters })).data,
    enabled,
    staleTime: 10_000,
  });
}

export function useDocumentSubcategories(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.documentSubcategories(filters),
    queryFn: async () =>
      (await api.get("/documents/subcategories", { params: filters })).data,
    staleTime: 10_000,
  });
}

export function useDocumentsCoverage() {
  return useQuery({
    queryKey: qk.documentCoverage,
    queryFn: async () => (await api.get("/documents/coverage")).data,
    staleTime: 10_000,
  });
}

export function useDocumentContent(id: string) {
  return useQuery({
    queryKey: qk.documentContent(id),
    queryFn: async () => (await api.get(`/documents/${id}/content`)).data,
    enabled: Boolean(id),
    staleTime: 10_000,
  });
}

export function useDocumentLinks(filters: {
  documentId?: string;
  entityType?: string;
  entityId?: string;
  pageSize?: number;
}) {
  return useQuery({
    queryKey: qk.documentLinks(filters),
    queryFn: async () =>
      (await api.get("/documents/links", { params: filters })).data,
    enabled: Boolean(
      filters.documentId || (filters.entityType && filters.entityId),
    ),
    staleTime: 5_000,
  });
}

export function useDocumentLinkCandidates(filters: {
  entityType?: string;
  q?: string;
  pageSize?: number;
}) {
  return useQuery({
    queryKey: qk.documentLinkCandidates(filters),
    queryFn: async () =>
      (await api.get("/documents/link-candidates", { params: filters })).data,
    enabled: Boolean(filters.entityType),
    staleTime: 10_000,
  });
}

export function useCreateDocumentLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      documentId: string;
      entityType: string;
      entityId: string;
      label?: string | null;
    }) => (await api.post("/documents/links", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents", "links"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["search"] });
    },
  });
}

export function useUpdateDocumentLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      payload: {
        documentId?: string;
        entityId?: string;
        label?: string | null;
      };
    }) => (await api.put(`/documents/links/${args.id}`, args.payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents", "links"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["search"] });
    },
  });
}

export function useDeleteDocumentLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/documents/links/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents", "links"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["search"] });
    },
  });
}

export function useDownloadDocument() {
  return useMutation({
    mutationFn: async (args: { id: string; fileName: string }) => {
      const response = await api.get(`/documents/${args.id}/download`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = args.fileName || `documento-${args.id}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return true;
    },
  });
}

export function useUpdateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      payload: {
        title?: string;
        category?: string;
        localityId?: string | null;
        subcategoryId?: string | null;
        sourcePath?: string;
      };
    }) => (await api.put(`/documents/${args.id}`, args.payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["search"] });
    },
  });
}

export function useCreateDocumentSubcategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      category: string;
      name: string;
      parentId?: string | null;
    }) => (await api.post("/documents/subcategories", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents", "subcategories"] });
      qc.invalidateQueries({ queryKey: ["documents", "coverage"] });
    },
  });
}

export function useUpdateDocumentSubcategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      payload: { name?: string; parentId?: string | null };
    }) =>
      (await api.put(`/documents/subcategories/${args.id}`, args.payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents", "subcategories"] });
      qc.invalidateQueries({ queryKey: ["documents", "coverage"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useDeleteDocumentSubcategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/documents/subcategories/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents", "subcategories"] });
      qc.invalidateQueries({ queryKey: ["documents", "coverage"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useExecutiveDashboard(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.executiveDashboard(filters),
    queryFn: async () =>
      (await api.get("/dashboard/executive", { params: filters })).data,
    staleTime: 15_000,
  });
}

export function useDashboardRecruits(
  filters: Record<string, any> = {},
  enabled = true,
) {
  return useQuery({
    queryKey: qk.dashboardRecruits(filters),
    queryFn: async () =>
      (await api.get("/dashboard/recruits", { params: filters })).data,
    enabled,
    staleTime: 15_000,
  });
}

export function useKpiDashboard(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.kpiDashboard(filters),
    queryFn: async () =>
      (await api.get("/kpis/dashboard", { params: filters })).data,
    staleTime: 15_000,
  });
}

export function useBiSurveyDashboard(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.biSurveyDashboard(filters),
    queryFn: async () =>
      (await api.get("/bi/surveys/dashboard", { params: filters })).data,
    staleTime: 15_000,
  });
}

export function useBiSurveyResponses(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.biSurveyResponses(filters),
    queryFn: async () =>
      (await api.get("/bi/surveys/responses", { params: filters })).data,
    staleTime: 5_000,
  });
}

export function useBiSurveyQuestions(
  filters: Record<string, any>,
  enabled = true,
) {
  return useQuery({
    queryKey: qk.biSurveyQuestions(filters),
    queryFn: async () =>
      (await api.get("/bi/surveys/questions", { params: filters })).data,
    enabled,
    staleTime: 10_000,
  });
}

export function useBiSurveyImports(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.biSurveyImports(filters),
    queryFn: async () =>
      (await api.get("/bi/surveys/imports", { params: filters })).data,
    staleTime: 10_000,
  });
}

export function useBiSurveyCardSettings(enabled = true) {
  return useQuery({
    queryKey: qk.biSurveyCardSettings(),
    queryFn: async () => (await api.get("/bi/surveys/card-settings")).data,
    enabled,
    staleTime: 20_000,
  });
}

export type BiImportNormalizationSuggestion = {
  id: string;
  sourceType: string;
  fieldKey: string;
  fieldLabel: string;
  kind: "OM" | "SPECIALTY";
  originalValue: string;
  suggestedValue: string;
  confidence: number | null;
  resolutionMethod: string | null;
  reasoning: string | null;
  rowCount: number;
  sampleRows: number[];
};

export type BiImportNormalizationUnresolved = {
  id: string;
  sourceType: string;
  fieldKey: string;
  fieldLabel: string;
  kind: "OM";
  originalValue: string;
  resolutionMethod: string | null;
  reasoning: string | null;
  rowCount: number;
  sampleRows: number[];
};

export type BiImportNormalizationPreview = {
  sourceType: string;
  totalRows: number;
  suggestions: BiImportNormalizationSuggestion[];
  unresolved: BiImportNormalizationUnresolved[];
  summary: {
    suggestionCount: number;
    unresolvedCount: number;
    omSuggestionCount: number;
    specialtySuggestionCount: number;
  };
};

export type BiImportNormalizationDecision = {
  id: string;
  apply: boolean;
};

type BiImportMutationArgs = {
  file: File;
  replace?: boolean;
};

type BiConfirmedImportArgs = BiImportMutationArgs & {
  normalizationPlan?: {
    decisions?: BiImportNormalizationDecision[];
  } | null;
};

export function useImportBiSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: BiConfirmedImportArgs) => {
      const form = new FormData();
      form.append("file", args.file);
      if (typeof args.replace === "boolean") {
        form.append("replace", String(args.replace));
      }
      if (args.normalizationPlan) {
        form.append(
          "normalizationPlan",
          JSON.stringify(args.normalizationPlan),
        );
      }
      return (await api.post("/bi/surveys/import", form)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["biSurvey"] });
    },
  });
}

export function usePreviewImportBiSurvey() {
  return useMutation({
    mutationFn: async (args: BiImportMutationArgs) => {
      const form = new FormData();
      form.append("file", args.file);
      if (typeof args.replace === "boolean") {
        form.append("replace", String(args.replace));
      }
      form.append("preview", "true");
      return (await api.post("/bi/surveys/import", form)).data;
    },
  });
}

export function useDeleteBiSurveyResponses() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      ids?: string[];
      allFiltered?: boolean;
      from?: string;
      to?: string;
      mission?: string;
      om?: string;
      posto?: string;
      postoGraduacao?: string;
      autodeclara?: string;
      suffered?: string;
      violenceType?: string;
      q?: string;
      combineMode?: "AND" | "OR";
    }) => (await api.post("/bi/surveys/responses/delete", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["biSurvey"] });
    },
  });
}

export function useUpdateBiSurveyCardSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      cardId: string;
      payload: { title?: string; description?: string | null };
    }) =>
      (
        await api.put(
          `/bi/surveys/card-settings/${encodeURIComponent(args.cardId)}`,
          args.payload,
        )
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["biSurvey"] });
    },
  });
}

export function useBiDomesticViolenceDashboard(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.biDomesticViolenceDashboard(filters),
    queryFn: async () =>
      (await api.get("/bi/domestic-violence/dashboard", { params: filters }))
        .data,
    staleTime: 15_000,
  });
}

export function useBiDomesticViolenceResponses(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.biDomesticViolenceResponses(filters),
    queryFn: async () =>
      (await api.get("/bi/domestic-violence/responses", { params: filters }))
        .data,
    staleTime: 5_000,
  });
}

export function useBiDomesticViolenceImports(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.biDomesticViolenceImports(filters),
    queryFn: async () =>
      (await api.get("/bi/domestic-violence/imports", { params: filters }))
        .data,
    staleTime: 10_000,
  });
}

export function useBiDomesticViolenceCardSettings(enabled = true) {
  return useQuery({
    queryKey: qk.biDomesticViolenceCardSettings(),
    queryFn: async () =>
      (await api.get("/bi/domestic-violence/card-settings")).data,
    enabled,
    staleTime: 20_000,
  });
}

export function useImportBiDomesticViolence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: BiConfirmedImportArgs) => {
      const form = new FormData();
      form.append("file", args.file);
      if (typeof args.replace === "boolean") {
        form.append("replace", String(args.replace));
      }
      if (args.normalizationPlan) {
        form.append(
          "normalizationPlan",
          JSON.stringify(args.normalizationPlan),
        );
      }
      return (await api.post("/bi/domestic-violence/import", form)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["biDomesticViolence"] });
    },
  });
}

export function usePreviewImportBiDomesticViolence() {
  return useMutation({
    mutationFn: async (args: BiImportMutationArgs) => {
      const form = new FormData();
      form.append("file", args.file);
      if (typeof args.replace === "boolean") {
        form.append("replace", String(args.replace));
      }
      form.append("preview", "true");
      return (await api.post("/bi/domestic-violence/import", form)).data;
    },
  });
}

export function useDeleteBiDomesticViolenceResponses() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      ids?: string[];
      allFiltered?: boolean;
      from?: string;
      to?: string;
      organization?: string;
      rank?: string;
      maritalStatus?: string;
      education?: string;
      naturality?: string;
      fabBond?: string;
      situationScope?: string;
      sufferedLifetime?: string;
      sufferedLast12Months?: string;
      frequency?: string;
      affectiveBond?: string;
      violenceType?: string;
      authorRelation?: string;
      impactIntensity?: string;
      impactArea?: string;
      soughtHelp?: string;
      complaintChannel?: string;
      noComplaintReason?: string;
      authorMilitaryLink?: string;
      occurrencePlace?: string;
      witnesses?: string;
      q?: string;
      combineMode?: "AND" | "OR";
    }) =>
      (await api.post("/bi/domestic-violence/responses/delete", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["biDomesticViolence"] });
    },
  });
}

export function useUpdateBiDomesticViolenceCardSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      cardId: string;
      payload: { title?: string; description?: string | null };
    }) =>
      (
        await api.put(
          `/bi/domestic-violence/card-settings/${encodeURIComponent(
            args.cardId,
          )}`,
          args.payload,
        )
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["biDomesticViolence"] });
    },
  });
}

export function useBiRecruitsDashboard(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.biRecruitsDashboard(filters),
    queryFn: async () =>
      (await api.get("/bi/recruits/dashboard", { params: filters })).data,
    staleTime: 15_000,
  });
}

export function useBiRecruitsResponses(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.biRecruitsResponses(filters),
    queryFn: async () =>
      (await api.get("/bi/recruits/responses", { params: filters })).data,
    staleTime: 5_000,
  });
}

export function useBiRecruitsImports(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.biRecruitsImports(filters),
    queryFn: async () =>
      (await api.get("/bi/recruits/imports", { params: filters })).data,
    staleTime: 10_000,
  });
}

export function useBiRecruitsCardSettings(enabled = true) {
  return useQuery({
    queryKey: qk.biRecruitsCardSettings(),
    queryFn: async () => (await api.get("/bi/recruits/card-settings")).data,
    enabled,
    staleTime: 20_000,
  });
}

export function useImportBiRecruits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { file: File; replace?: boolean }) => {
      const form = new FormData();
      form.append("file", args.file);
      if (typeof args.replace === "boolean") {
        form.append("replace", String(args.replace));
      }
      return (await api.post("/bi/recruits/import", form)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["biRecruits"] });
    },
  });
}

export function useDeleteBiRecruitsResponses() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      ids?: string[];
      allFiltered?: boolean;
      from?: string;
      to?: string;
      education?: string;
      gender?: string;
      identifyHarassment?: string;
      conductLimits?: string;
      knowOrientation?: string;
      knowReportProcess?: string;
      willingnessOrientation?: string;
      willingnessReport?: string;
      enlistmentDecisionInfluence?: string;
      q?: string;
      combineMode?: "AND" | "OR";
    }) => (await api.post("/bi/recruits/responses/delete", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["biRecruits"] });
    },
  });
}

export function useUpdateBiRecruitsCardSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      cardId: string;
      payload: { title?: string; description?: string | null };
    }) =>
      (
        await api.put(
          `/bi/recruits/card-settings/${encodeURIComponent(args.cardId)}`,
          args.payload,
        )
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["biRecruits"] });
    },
  });
}

export function useBiBestPracticesCycleDashboard(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.biBestPracticesCycleDashboard(filters),
    queryFn: async () =>
      (
        await api.get("/bi/best-practices-cycle/dashboard", {
          params: filters,
        })
      ).data,
    staleTime: 15_000,
  });
}

export function useBiBestPracticesCycleResponses(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.biBestPracticesCycleResponses(filters),
    queryFn: async () =>
      (
        await api.get("/bi/best-practices-cycle/responses", {
          params: filters,
        })
      ).data,
    staleTime: 5_000,
  });
}

export function useBiBestPracticesCycleImports(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.biBestPracticesCycleImports(filters),
    queryFn: async () =>
      (
        await api.get("/bi/best-practices-cycle/imports", {
          params: filters,
        })
      ).data,
    staleTime: 10_000,
  });
}

export function useBiBestPracticesCycleCardSettings(enabled = true) {
  return useQuery({
    queryKey: qk.biBestPracticesCycleCardSettings(),
    queryFn: async () =>
      (await api.get("/bi/best-practices-cycle/card-settings")).data,
    enabled,
    staleTime: 20_000,
  });
}

export function useImportBiBestPracticesCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: BiConfirmedImportArgs) => {
      const form = new FormData();
      form.append("file", args.file);
      if (typeof args.replace === "boolean") {
        form.append("replace", String(args.replace));
      }
      if (args.normalizationPlan) {
        form.append(
          "normalizationPlan",
          JSON.stringify(args.normalizationPlan),
        );
      }
      return (await api.post("/bi/best-practices-cycle/import", form)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["biBestPracticesCycle"] });
    },
  });
}

export function usePreviewImportBiBestPracticesCycle() {
  return useMutation({
    mutationFn: async (args: BiImportMutationArgs) => {
      const form = new FormData();
      form.append("file", args.file);
      if (typeof args.replace === "boolean") {
        form.append("replace", String(args.replace));
      }
      form.append("preview", "true");
      return (await api.post("/bi/best-practices-cycle/import", form)).data;
    },
  });
}

export function useDeleteBiBestPracticesCycleResponses() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      ids?: string[];
      allFiltered?: boolean;
      from?: string;
      to?: string;
      technicalRigorPerception?: string;
      preparednessToLeadMixedClass?: string;
      genderBiasImpact?: string;
      interactionDifference?: string;
      supportNeedRecognition?: string;
      mainChallengeOption?: string;
      identification?: string;
      specialty?: string;
      q?: string;
      combineMode?: "AND" | "OR";
    }) =>
      (await api.post("/bi/best-practices-cycle/responses/delete", payload))
        .data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["biBestPracticesCycle"] });
    },
  });
}

export function useUpdateBiBestPracticesCycleCardSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      cardId: string;
      payload: { title?: string; description?: string | null };
    }) =>
      (
        await api.put(
          `/bi/best-practices-cycle/card-settings/${encodeURIComponent(
            args.cardId,
          )}`,
          args.payload,
        )
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["biBestPracticesCycle"] });
    },
  });
}

export function useBiCpcaMeetingDashboard(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.biCpcaMeetingDashboard(filters),
    queryFn: async () =>
      (await api.get("/bi/cpca-meeting/dashboard", { params: filters })).data,
    staleTime: 15_000,
  });
}

export function useBiCpcaMeetingResponses(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.biCpcaMeetingResponses(filters),
    queryFn: async () =>
      (await api.get("/bi/cpca-meeting/responses", { params: filters })).data,
    staleTime: 5_000,
  });
}

export function useBiCpcaMeetingImports(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.biCpcaMeetingImports(filters),
    queryFn: async () =>
      (await api.get("/bi/cpca-meeting/imports", { params: filters })).data,
    staleTime: 10_000,
  });
}

export function useBiCpcaMeetingCardSettings(enabled = true) {
  return useQuery({
    queryKey: qk.biCpcaMeetingCardSettings(),
    queryFn: async () => (await api.get("/bi/cpca-meeting/card-settings")).data,
    enabled,
    staleTime: 20_000,
  });
}

export function useImportBiCpcaMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { file: File; replace?: boolean }) => {
      const form = new FormData();
      form.append("file", args.file);
      if (typeof args.replace === "boolean") {
        form.append("replace", String(args.replace));
      }
      return (await api.post("/bi/cpca-meeting/import", form)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["biCpcaMeeting"] });
    },
  });
}

export function useDeleteBiCpcaMeetingResponses() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      ids?: string[];
      allFiltered?: boolean;
      from?: string;
      to?: string;
      q?: string;
      combineMode?: "AND" | "OR";
      columnFilters?: Record<string, string>;
    }) => (await api.post("/bi/cpca-meeting/responses/delete", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["biCpcaMeeting"] });
    },
  });
}

export function useUpdateBiCpcaMeetingCardSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      cardId: string;
      payload: { title?: string; description?: string | null };
    }) =>
      (
        await api.put(
          `/bi/cpca-meeting/card-settings/${encodeURIComponent(args.cardId)}`,
          args.payload,
        )
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["biCpcaMeeting"] });
    },
  });
}

export function useBiGsdEvaluationDashboard(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.biGsdEvaluationDashboard(filters),
    queryFn: async () =>
      (await api.get("/bi/gsd-evaluation/dashboard", { params: filters })).data,
    staleTime: 15_000,
  });
}

export function useBiGsdEvaluationResponses(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.biGsdEvaluationResponses(filters),
    queryFn: async () =>
      (await api.get("/bi/gsd-evaluation/responses", { params: filters })).data,
    staleTime: 5_000,
  });
}

export function useBiGsdEvaluationImports(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.biGsdEvaluationImports(filters),
    queryFn: async () =>
      (await api.get("/bi/gsd-evaluation/imports", { params: filters })).data,
    staleTime: 10_000,
  });
}

export function useBiGsdEvaluationCardSettings(enabled = true) {
  return useQuery({
    queryKey: qk.biGsdEvaluationCardSettings(),
    queryFn: async () =>
      (await api.get("/bi/gsd-evaluation/card-settings")).data,
    enabled,
    staleTime: 20_000,
  });
}

export function useImportBiGsdEvaluation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { file: File; replace?: boolean }) => {
      const form = new FormData();
      form.append("file", args.file);
      if (typeof args.replace === "boolean") {
        form.append("replace", String(args.replace));
      }
      return (await api.post("/bi/gsd-evaluation/import", form)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["biGsdEvaluation"] });
    },
  });
}

export function useDeleteBiGsdEvaluationResponses() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      ids?: string[];
      allFiltered?: boolean;
      from?: string;
      to?: string;
      q?: string;
      combineMode?: "AND" | "OR";
      columnFilters?: Record<string, string>;
    }) => (await api.post("/bi/gsd-evaluation/responses/delete", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["biGsdEvaluation"] });
    },
  });
}

export function useUpdateBiGsdEvaluationCardSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      cardId: string;
      payload: { title?: string; description?: string | null };
    }) =>
      (
        await api.put(
          `/bi/gsd-evaluation/card-settings/${encodeURIComponent(args.cardId)}`,
          args.payload,
        )
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["biGsdEvaluation"] });
    },
  });
}

export function useStrategicDashboard() {
  return useQuery({
    queryKey: ["strategic", "dashboard"],
    queryFn: async () => (await api.get("/strategic/dashboard")).data,
  });
}

export function useComgepSituationRoom(enabled = true) {
  return useQuery({
    queryKey: qk.comgepSituationRoom,
    queryFn: async () => (await api.get("/strategic/comgep-room")).data,
    enabled,
    staleTime: 30_000,
  });
}

export function useComgepRecommendations(limit = 8, enabled = true) {
  return useQuery({
    queryKey: qk.comgepRecommendations(limit),
    queryFn: async () =>
      (
        await api.get("/strategic/comgep-recommendations", {
          params: { limit },
        })
      ).data,
    enabled,
    staleTime: 30_000,
  });
}

export function useAggressorProfile() {
  return useQuery({
    queryKey: ["strategic", "aggressorProfile"],
    queryFn: async () => (await api.get("/strategic/aggressor-profile")).data,
  });
}

export function useTextAnalysis() {
  return useQuery({
    queryKey: ["strategic", "textAnalysis"],
    queryFn: async () => (await api.get("/strategic/text-analysis")).data,
  });
}

export function useGeoMap() {
  return useQuery({
    queryKey: ["strategic", "geoMap"],
    queryFn: async () => (await api.get("/strategic/geo-map")).data,
  });
}

export function useExportExecutiveReportPdf() {
  return useMutation({
    mutationFn: async () => {
      const res = await api.get("/strategic/executive-report/pdf", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio-executivo-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    },
  });
}

function extractPdfFileName(
  contentDisposition: string | undefined,
  fallbackFileName: string,
) {
  const safeDisposition = String(contentDisposition ?? "");
  const fileNameMatch =
    /filename\*=(?:UTF-8'')?([^;]+)/i.exec(safeDisposition) ??
    /filename="?([^"]+)"?/i.exec(safeDisposition);
  const decodedName = fileNameMatch?.[1]
    ? decodeURIComponent(fileNameMatch[1].trim())
    : "";
  return (
    decodedName ||
    `${fallbackFileName}-${new Date().toISOString().slice(0, 10)}.pdf`
  );
}

function downloadPdfBlobResponse(
  response: {
    data: BlobPart;
    headers?: Record<string, unknown>;
  },
  fallbackFileName: string,
) {
  const contentType = String(
    response.headers?.["content-type"] ?? "",
  ).toLowerCase();
  if (!contentType.includes("application/pdf")) {
    throw new Error(
      "Não foi possível gerar o PDF. Faça login novamente e tente de novo.",
    );
  }
  const blob = new Blob([response.data], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = extractPdfFileName(
    String(response.headers?.["content-disposition"] ?? ""),
    fallbackFileName,
  );
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function useExportBiDashboardPdf(
  endpoint: string,
  fallbackFileName: string,
) {
  return useMutation({
    mutationFn: async (params?: Record<string, unknown>) => {
      const response = await api.get(endpoint, {
        params,
        responseType: "blob",
      });
      downloadPdfBlobResponse(response, fallbackFileName);
      return true;
    },
  });
}

export function useExportBiExecutiveNotebookPdf() {
  return useMutation({
    mutationFn: async (payload: {
      title?: string;
      panels: Array<{
        key: string;
        filters?: Record<string, unknown>;
      }>;
    }) => {
      const response = await api.post("/bi/executive-notebook/pdf", payload, {
        responseType: "blob",
      });
      downloadPdfBlobResponse(response, "caderno-executivo-bi");
      return true;
    },
  });
}

export function useExportComgepCopilotPdf() {
  return useMutation({
    mutationFn: async (payload: { sessionId: string }) => {
      const response = await api.post("/ai/action-agents/pdf", payload, {
        responseType: "blob",
      });
      downloadPdfBlobResponse(response, "copiloto-comgep");
      return true;
    },
  });
}

export type StrategicAiNarrativeResponse = {
  generatedAt: string;
  narrative: string;
  model: string;
};

export type AiAnalysisType =
  | "executive"
  | "situational"
  | "aggressor"
  | "text"
  | "geo"
  | "chatbot"
  | "cpca_agent"
  | "briefing_comgep"
  | "priorizacao_intervencao"
  | "governanca_cpca";

export type AiKnowledgeSourceId =
  | "missions"
  | "activities_smif"
  | "activities_cipavd"
  | "activity_reports"
  | "best_practices"
  | "tasks"
  | "survey_schools"
  | "survey_domestic_violence"
  | "survey_recruits"
  | "survey_best_practice_cycle"
  | "survey_cpca_meeting"
  | "survey_gsd_evaluation"
  | "complaints_cpca"
  | "complaints_smif";

export type AiAnalysisSourceSelection = Record<
  AiAnalysisType,
  AiKnowledgeSourceId[]
>;

export type AiProfileFeatureId =
  | "structured_situational"
  | "structured_complaints"
  | "structured_text"
  | "structured_geo"
  | "rag_knowledge_bases"
  | "traceability_links"
  | "suggested_links"
  | "suggested_actions"
  | "cpca_case_inconsistencies"
  | "comgep_room";

export type AiProfileFeatureSelection = Record<
  AiAnalysisType,
  AiProfileFeatureId[]
>;

export type AiKnowledgeBaseTheme = "CIPAVD" | "SMIF" | "CPCA" | "SHARED";

export type AdminKnowledgeBase = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  theme: AiKnowledgeBaseTheme;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  _count?: {
    documents?: number;
    chunks?: number;
  };
  documentStatusSummary?: {
    pending: number;
    indexing: number;
    ready: number;
    failed: number;
  };
};

export type AdminKnowledgeBaseDocument = {
  id: string;
  knowledgeBaseId: string;
  title: string;
  fileName: string;
  fileUrl: string;
  storageKey?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  checksum?: string | null;
  status: "PENDING" | "INDEXING" | "READY" | "FAILED";
  contentText?: string | null;
  parsedAt?: string | null;
  lastIndexedAt?: string | null;
  chunkCount: number;
  indexError?: string | null;
  metadataJson?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  knowledgeBase?: {
    id: string;
    key: string;
    name: string;
    theme: AiKnowledgeBaseTheme;
  };
  _count?: {
    chunks?: number;
  };
  downloadUrl?: string;
};

export type AiSettingsResponse = {
  systemPrompt: string;
  baseUrl: string;
  apiKey: string;
  apiKeyMasked: string;
  model: string;
  embeddingModel: string;
  analysisPrompts: Record<string, string>;
  analysisSources: AiAnalysisSourceSelection;
  analysisKnowledgeBases: Record<AiAnalysisType, string[]>;
  analysisFeatures: AiProfileFeatureSelection;
};

export type AiSettingsPatch = {
  systemPrompt?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  embeddingModel?: string;
  analysisPrompts?: Record<string, string>;
  analysisSources?: Partial<Record<AiAnalysisType, AiKnowledgeSourceId[]>>;
  analysisKnowledgeBases?: Partial<Record<AiAnalysisType, string[]>>;
  analysisFeatures?: Partial<Record<AiAnalysisType, AiProfileFeatureId[]>>;
};

export type ComgepScoringWeightKey =
  | "riskOpenCases"
  | "riskRetaliationCases"
  | "riskStalledCases"
  | "riskSexualFormalCases"
  | "riskSurveyRate"
  | "riskDomesticRate"
  | "riskSexualSignals"
  | "riskMoralSignals"
  | "riskMilitaryAuthor"
  | "riskUnderreportPercent"
  | "riskUncoveredOmPenalty"
  | "presenceMissions"
  | "presenceCompletedActivities"
  | "presenceSignedReports";

export type ComgepScoringGroupId = "risk" | "presence";

export type ComgepScoringSettingItem = {
  key: ComgepScoringWeightKey;
  group: ComgepScoringGroupId;
  label: string;
  description: string;
  impact: string;
  appliesTo: "OM" | "UF" | "OM e UF";
  unitLabel: string;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  value: number;
};

export type ComgepScoringSettingsResponse = {
  groups: Array<{
    id: ComgepScoringGroupId;
    label: string;
    description: string;
    effectSummary: string;
    items: ComgepScoringSettingItem[];
  }>;
  values: Record<ComgepScoringWeightKey, number>;
};

export type ComgepScoringSettingsPatch = {
  weights: Partial<Record<ComgepScoringWeightKey, number>>;
};

export function useStrategicAiNarrative() {
  return useMutation({
    mutationFn: async () =>
      (
        await api.get<StrategicAiNarrativeResponse>("/strategic/ai-narrative", {
          params: { t: Date.now() },
        })
      ).data,
  });
}

export function useAiSettings() {
  return useQuery({
    queryKey: qk.aiSettings,
    queryFn: async () =>
      (await api.get<AiSettingsResponse>("/admin/ai-settings")).data,
  });
}

export function useKnowledgeBases() {
  return useQuery({
    queryKey: qk.knowledgeBases,
    queryFn: async () =>
      (await api.get<{ items: AdminKnowledgeBase[] }>("/admin/knowledge-bases"))
        .data,
    staleTime: 10_000,
  });
}

export function useSelectableKnowledgeBases() {
  return useQuery({
    queryKey: qk.knowledgeBasesSelectable,
    queryFn: async () =>
      (
        await api.get<{ items: AdminKnowledgeBase[] }>(
          "/admin/knowledge-bases/selectable",
        )
      ).data,
    staleTime: 10_000,
  });
}

export function useKnowledgeBaseDocuments(
  knowledgeBaseId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: qk.knowledgeBaseDocuments(knowledgeBaseId),
    queryFn: async () =>
      (
        await api.get<{ items: AdminKnowledgeBaseDocument[] }>(
          `/admin/knowledge-bases/${knowledgeBaseId}/documents`,
        )
      ).data,
    enabled: Boolean(knowledgeBaseId) && enabled,
    staleTime: 5_000,
  });
}

export function useComgepScoringSettings() {
  return useQuery({
    queryKey: qk.comgepSettings,
    queryFn: async () =>
      (await api.get<ComgepScoringSettingsResponse>("/admin/comgep-settings"))
        .data,
  });
}

export function useBiNormalizationOverview(enabled = true) {
  return useQuery({
    queryKey: qk.biNormalizationOverview,
    queryFn: async () => (await api.get("/bi/normalization/overview")).data,
    enabled,
    staleTime: 30_000,
  });
}

export type BiNormalizationReviewGroup = {
  id: string;
  sourceType: string;
  fieldLabel: string;
  targetFieldSource: "SCALAR" | "JSON" | "NONE";
  status: "READY_TO_APPLY" | "NEEDS_MANUAL_SELECTION";
  totalRecords: number;
  recordIds: string[];
  variants: Array<{ value: string; count: number }>;
  suggestedOm: {
    id: string;
    code: string;
    name: string;
    uf: string | null;
  } | null;
  targetReference: string | null;
  confidence: number | null;
  resolutionMethod: string | null;
  reasoning: string | null;
  sampleValue: string | null;
  summary: string;
};

export type BiNormalizationReviewSource = {
  sourceType: string;
  label: string;
  description: string;
  supported: boolean;
  totalGroups: number;
  totalRecords: number;
  readyGroups: number;
  readyRecords: number;
  unresolvedGroups: number;
  unresolvedRecords: number;
  groups: BiNormalizationReviewGroup[];
};

export type BiNormalizationReviewResponse = {
  generatedAt: string;
  overall: {
    totalGroups: number;
    totalRecords: number;
    readyGroups: number;
    readyRecords: number;
    unresolvedGroups: number;
    unresolvedRecords: number;
  };
  sources: BiNormalizationReviewSource[];
};

export function useBiNormalizationReview(
  sourceType?: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: qk.biNormalizationReview(sourceType),
    queryFn: async () =>
      (
        await api.get<BiNormalizationReviewResponse>(
          "/bi/normalization/review",
          {
            params: sourceType ? { sourceType } : undefined,
          },
        )
      ).data,
    enabled,
    staleTime: 30_000,
  });
}

export function useRebuildBiNormalization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload?: { sourceType?: string | null }) =>
      (await api.post("/bi/normalization/rebuild", payload ?? {})).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.biNormalizationOverview });
      qc.invalidateQueries({ queryKey: ["bi", "normalization", "review"] });
      qc.invalidateQueries({ queryKey: qk.comgepSituationRoom });
    },
  });
}

export function useApplyBiNormalization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      sourceType: string;
      sourceRecordIds: string[];
      omId?: string | null;
    }) => (await api.post("/bi/normalization/apply", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.biNormalizationOverview });
      qc.invalidateQueries({ queryKey: ["bi", "normalization", "review"] });
      qc.invalidateQueries({ queryKey: qk.comgepSituationRoom });
    },
  });
}

export function useApplyReadyBiNormalization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload?: { sourceType?: string | null }) =>
      (await api.post("/bi/normalization/apply-ready", payload ?? {})).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.biNormalizationOverview });
      qc.invalidateQueries({ queryKey: ["bi", "normalization", "review"] });
      qc.invalidateQueries({ queryKey: qk.comgepSituationRoom });
    },
  });
}

export function useAiActionAgents(enabled = true) {
  return useQuery({
    queryKey: qk.aiActionAgents,
    queryFn: async () => (await api.get("/ai/action-agents")).data,
    enabled,
    staleTime: 60_000,
  });
}

export function useCreateComgepRecommendation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      title: string;
      summary: string;
      sessionId?: string | null;
      sourceAgentType: string;
      mode: string;
      focusType?: string | null;
      focusLabel?: string | null;
      uf?: string | null;
      omId?: string | null;
      evidence?: unknown;
    }) => (await api.post("/strategic/comgep-recommendations", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["strategic", "comgepRecommendations"],
      });
    },
  });
}

export function useUpdateAiSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AiSettingsPatch) =>
      (await api.put("/admin/ai-settings", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.aiSettings });
    },
  });
}

export function useCreateKnowledgeBase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      key?: string;
      name: string;
      description?: string | null;
      theme?: AiKnowledgeBaseTheme | null;
      isActive?: boolean;
      sortOrder?: number | null;
    }) => (await api.post("/admin/knowledge-bases", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.knowledgeBases });
      qc.invalidateQueries({ queryKey: qk.knowledgeBasesSelectable });
      qc.invalidateQueries({ queryKey: qk.aiSettings });
    },
  });
}

export function useUpdateKnowledgeBase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      payload: {
        key?: string;
        name?: string;
        description?: string | null;
        theme?: AiKnowledgeBaseTheme | null;
        isActive?: boolean;
        sortOrder?: number | null;
      };
    }) =>
      (await api.put(`/admin/knowledge-bases/${args.id}`, args.payload)).data,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.knowledgeBases });
      qc.invalidateQueries({ queryKey: qk.knowledgeBasesSelectable });
      qc.invalidateQueries({
        queryKey: qk.knowledgeBaseDocuments(variables.id),
      });
      qc.invalidateQueries({ queryKey: qk.aiSettings });
    },
  });
}

export function useDeleteKnowledgeBase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/admin/knowledge-bases/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.knowledgeBases });
      qc.invalidateQueries({ queryKey: qk.knowledgeBasesSelectable });
      qc.invalidateQueries({ queryKey: qk.aiSettings });
    },
  });
}

export function useUploadKnowledgeBaseDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      knowledgeBaseId: string;
      file: File;
      title?: string;
    }) => {
      const formData = new FormData();
      formData.append("file", args.file);
      if (args.title) formData.append("title", args.title);
      return (
        await api.post(
          `/admin/knowledge-bases/${args.knowledgeBaseId}/documents/upload`,
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
          },
        )
      ).data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.knowledgeBases });
      qc.invalidateQueries({
        queryKey: qk.knowledgeBaseDocuments(variables.knowledgeBaseId),
      });
    },
  });
}

export function useUpdateKnowledgeBaseDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      knowledgeBaseId: string;
      payload: { title?: string | null };
    }) =>
      (
        await api.put(
          `/admin/knowledge-bases/documents/${args.id}`,
          args.payload,
        )
      ).data,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.knowledgeBases });
      qc.invalidateQueries({
        queryKey: qk.knowledgeBaseDocuments(variables.knowledgeBaseId),
      });
    },
  });
}

export function useDeleteKnowledgeBaseDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; knowledgeBaseId: string }) =>
      (await api.delete(`/admin/knowledge-bases/documents/${args.id}`)).data,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.knowledgeBases });
      qc.invalidateQueries({
        queryKey: qk.knowledgeBaseDocuments(variables.knowledgeBaseId),
      });
    },
  });
}

export function useReindexKnowledgeBase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (knowledgeBaseId: string) =>
      (await api.post(`/admin/knowledge-bases/${knowledgeBaseId}/reindex`))
        .data,
    onSuccess: (_data, knowledgeBaseId) => {
      qc.invalidateQueries({ queryKey: qk.knowledgeBases });
      qc.invalidateQueries({
        queryKey: qk.knowledgeBaseDocuments(knowledgeBaseId),
      });
    },
  });
}

export function useReindexKnowledgeBaseDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; knowledgeBaseId: string }) =>
      (await api.post(`/admin/knowledge-bases/documents/${args.id}/reindex`))
        .data,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.knowledgeBases });
      qc.invalidateQueries({
        queryKey: qk.knowledgeBaseDocuments(variables.knowledgeBaseId),
      });
    },
  });
}

export function useDownloadKnowledgeBaseDocument() {
  return useMutation({
    mutationFn: async (args: { id: string; fileName: string }) => {
      const response = await api.get(
        `/admin/knowledge-bases/documents/${args.id}/download`,
        {
          responseType: "blob",
        },
      );
      const blob = new Blob([response.data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = args.fileName || `base-conhecimento-${args.id}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return true;
    },
  });
}

export function useUpdateComgepScoringSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ComgepScoringSettingsPatch) =>
      (await api.put("/admin/comgep-settings", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.comgepSettings });
      qc.invalidateQueries({ queryKey: qk.comgepSituationRoom });
    },
  });
}

export function useTestAiConnection() {
  return useMutation({
    mutationFn: async () =>
      (await api.get("/admin/ai-settings/test")).data as {
        ok: boolean;
        models: string[];
        error?: string;
      },
  });
}
