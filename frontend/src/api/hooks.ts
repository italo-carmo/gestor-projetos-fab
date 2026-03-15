import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { qk } from "./queryKeys";
import { splitMilitaryNameAndOm, toMilitaryDisplayName } from "../app/militaryName";

export function useMe() {
  return useQuery({
    queryKey: qk.me,
    queryFn: async () => (await api.get("/auth/me")).data,
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: async (args: { login: string; password: string }) =>
      (await api.post("/auth/login", args)).data,
  });
}

export function useTasks(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.tasks(filters),
    queryFn: async () =>
      (await api.get("/task-instances", { params: filters })).data,
    staleTime: 15_000,
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

export function useActivityTypes() {
  return useQuery({
    queryKey: qk.activityTypes,
    queryFn: async () => (await api.get("/activities/types")).data,
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

export function useMissionStatistics() {
  return useQuery({
    queryKey: ["missions", "statistics"],
    queryFn: async () => (await api.get("/missions/statistics")).data,
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
    queryFn: async () => (await api.get(`/missions/${missionId}/checklist`)).data,
    enabled: Boolean(missionId) && enabled,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });
}

export function useMissionChecklistMapping(
  filters: { localityId?: string },
  enabled = true,
) {
  const normalized = {
    localityId: filters.localityId || undefined,
  };
  return useQuery({
    queryKey: qk.missionChecklistMapping(normalized),
    queryFn: async () =>
      (await api.get('/missions/checklist/mapping', { params: normalized })).data,
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
        items: Array<{
          id: string;
          classification:
            | "FORTE_CONSOLIDADA"
            | "OPORTUNIDADE_MELHORIA"
            | "NECESSITA_ANALISE"
            | "POSSIVEL_RISCO";
          notes?: string;
        }>;
      };
    }) => (await api.put(`/missions/${args.id}/checklist`, args.payload)).data,
    onSuccess: (_data, args) => {
      qc.invalidateQueries({ queryKey: qk.missionChecklist(args.id) });
      qc.invalidateQueries({ queryKey: qk.mission(args.id) });
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
    }) => (await api.post("/missions", payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["missions"] }),
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
      const contentType = String(response.headers?.["content-type"] ?? "").toLowerCase();
      if (!contentType.includes("application/pdf")) {
        throw new Error("Não foi possível exportar o PDF. Faça login novamente e tente de novo.");
      }
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const contentDisposition = String(response.headers?.["content-disposition"] ?? "");
      const fileNameMatch =
        /filename\*=(?:UTF-8'')?([^;]+)/i.exec(contentDisposition) ??
        /filename="?([^"]+)"?/i.exec(contentDisposition);
      const decodedName = fileNameMatch?.[1] ? decodeURIComponent(fileNameMatch[1].trim()) : "";
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
      responsibleUserIds?: string[];
      eventDate?: string | null;
      reportRequired?: boolean;
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
    mutationFn: async (payload: { name: string }) =>
      (await api.post("/activities/types", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.activityTypes });
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
      (await api.put('/activities/batch/reorder', { ids })).data as { updated: number },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activities'] });
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
    mutationFn: async (args: { ids: string[]; specialtyId: string | null }) =>
      (await api.put("/activities/batch/specialty", args)).data,
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
        publicProfile?: string;
        instructorsCount?: number;
        recruitsCount?: number;
        eloPsychologyCount?: number;
        eloSocialAssistanceCount?: number;
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
    mutationFn: async (id: string) =>
      (await api.post(`/activities/${id}/report/sign`)).data,
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
      const responses = await Promise.all(
        normalized.map(async (localityId) => {
          const response = await api.get("/task-instances/assignees", {
            params: { localityId },
          });
          return response.data?.items ?? [];
        }),
      );
      const merged = new Map<string, { id: string; name: string }>();
      responses.flat().forEach((item: any) => {
        if (item?.type !== "USER" || !item?.id) return;
        const id = String(item.id);
        if (!merged.has(id)) {
          merged.set(id, {
            id,
            name: String(item.label ?? `Usuário ${id.slice(0, 8)}`),
          });
        }
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
      localityIds: string[];
      sourceTaskIds?: string[];
    }) =>
      (
        await api.put(`/task-instances/${args.id}/localities`, {
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

export function usePostos() {
  return useQuery({
    queryKey: qk.postos,
    queryFn: async () => (await api.get("/postos")).data,
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
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['gantt'] });
      qc.invalidateQueries({ queryKey: ['calendar'] });
      qc.invalidateQueries({ queryKey: ['checklists'] });
      qc.invalidateQueries({ queryKey: ['meetings'] });
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useCreateTaskInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      title: string;
      description?: string | null;
      phaseId: string;
      dueDate: string;
      priority?: string;
      localityIds: string[];
      assignedToId?: string | null;
      assigneeIds?: string[];
    }) => (await api.post("/task-instances", payload)).data,
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
      (await api.get("/admin/rbac/ldap-user", { params: { uid: identifier } })).data,
  });
}

export function useUpsertLdapUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      uid: string;
      roleId?: string;
      roleIds?: string[];
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
    queryFn: async () => (await api.get("/best-practices", { params: filters })).data,
    enabled,
    staleTime: 10_000,
  });
}

export function useLessonsLearned(filters: Record<string, any>, enabled = true) {
  return useQuery({
    queryKey: qk.lessonsLearned(filters),
    queryFn: async () => (await api.get("/lessons-learned", { params: filters })).data,
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
    mutationFn: async (id: string) => (await api.delete(`/best-practices/${id}`)).data,
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
    mutationFn: async (payload: { name: string; colorHex: string; textColorHex?: string }) =>
      (await api.post("/best-practices/types", payload)).data,
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
    }) => (await api.put(`/best-practices/types/${args.id}`, args.payload)).data,
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
    mutationFn: async (id: string) => (await api.delete(`/best-practices/types/${id}`)).data,
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
    mutationFn: async (id: string) => (await api.delete(`/lessons-learned/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lessonsLearned"] }),
  });
}

export function useCreateLessonLearnedType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; colorHex: string }) =>
      (await api.post("/lessons-learned/types", payload)).data,
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
      payload: { name?: string; colorHex?: string };
    }) => (await api.put(`/lessons-learned/types/${args.id}`, args.payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lessonLearnedTypes"] });
      qc.invalidateQueries({ queryKey: ["lessonsLearned"] });
    },
  });
}

export function useDeleteLessonLearnedType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/lessons-learned/types/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lessonLearnedTypes"] });
      qc.invalidateQueries({ queryKey: ["lessonsLearned"] });
    },
  });
}

/** Library */
export function useLibrary() {
  return useQuery({
    queryKey: qk.library,
    queryFn: async () => (await api.get("/library")).data,
    staleTime: 10_000,
  });
}

export function useUpdateLibrarySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { carouselIntervalSeconds: number }) =>
      (await api.put("/library/settings", payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.library }),
  });
}

export function useUploadLibraryPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { file: File; title?: string; localityId?: string }) => {
      const formData = new FormData();
      formData.append("file", args.file);
      if (args.title) formData.append("title", args.title);
      if (args.localityId) formData.append("localityId", args.localityId);
      return (
        await api.post("/library/photos/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
      ).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.library }),
  });
}

export function useUpdateLibraryPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      payload: { title?: string; sortOrder?: number; localityId?: string | null };
    }) => (await api.put(`/library/photos/${args.id}`, args.payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.library }),
  });
}

export function useDeleteLibraryPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/library/photos/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.library }),
  });
}

export function useUploadLibraryDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { file: File; title?: string }) => {
      const formData = new FormData();
      formData.append("file", args.file);
      if (args.title) formData.append("title", args.title);
      return (
        await api.post("/library/documents/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
      ).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.library }),
  });
}

export function useUpdateLibraryDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; payload: { title?: string } }) =>
      (await api.put(`/library/documents/${args.id}`, args.payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.library }),
  });
}

export function useDeleteLibraryDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/library/documents/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.library }),
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
      const data = (await api.get("/org-chart/commission-members", { params: filters }))
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
      const data = (await api.get("/org-chart/commission-candidates", { params: filters }))
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

export function useOrgChartCandidates(
  filters: Record<string, any>,
  enabled = true,
) {
  return useQuery({
    queryKey: ["orgChart", "candidates", filters],
    queryFn: async () => {
      const data = (await api.get("/org-chart/candidates", { params: filters })).data;
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
      (await api.put('/org-chart/commission-members/reorder', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orgChart', 'commissionMembers'] });
      qc.invalidateQueries({ queryKey: ['orgChart'] });
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

/** CPCA cases */
export function useCpcaCases(filters: Record<string, any>, enabled = true) {
  return useQuery({
    queryKey: qk.cpcaCases(filters),
    queryFn: async () => (await api.get("/cpca-cases", { params: filters })).data,
    enabled,
    staleTime: 10_000,
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

export function useCpcaCaseStats(filters: Record<string, any>, enabled = true) {
  return useQuery({
    queryKey: qk.cpcaCaseStats(filters),
    queryFn: async () => (await api.get("/cpca-cases/stats", { params: filters })).data,
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

export function useAddCpcaCaseComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; text: string }) =>
      (await api.post(`/cpca-cases/${args.id}/comments`, { text: args.text })).data,
    onSuccess: (_data, args) => {
      qc.invalidateQueries({ queryKey: ["cpcaCases"] });
      qc.invalidateQueries({ queryKey: qk.cpcaCase(args.id) });
    },
  });
}

export function useLocalities(enabled = true) {
  return useQuery({
    queryKey: qk.localities,
    queryFn: async () => (await api.get("/localities")).data,
    enabled,
    staleTime: 60_000,
  });
}

export function useOmsCatalog(enabled = true) {
  return useQuery({
    queryKey: qk.omsCatalog,
    queryFn: async () => (await api.get("/localities/oms-catalog")).data,
    enabled,
    staleTime: 60_000,
  });
}

export function useLocalityRecruitDesignations(localityId: string, enabled = true) {
  return useQuery({
    queryKey: qk.recruitDesignations(localityId || ""),
    queryFn: async () => (await api.get(`/localities/${localityId}/recruit-designations`)).data,
    enabled: Boolean(localityId) && enabled,
    staleTime: 10_000,
  });
}

export function useLocalityRecruitMembers(localityId: string, enabled = true) {
  return useQuery({
    queryKey: ['localities', 'recruitMembers', localityId || ''],
    queryFn: async () => (await api.get(`/localities/${localityId}/recruits-members`)).data,
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

export function useCreateLocality() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, any>) =>
      (await api.post('/localities', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.localities });
      qc.invalidateQueries({ queryKey: ['dashboardRecruits'] });
      qc.invalidateQueries({ queryKey: ['dashboardNational'] });
      qc.invalidateQueries({ queryKey: ['dashboardExecutive'] });
    },
  });
}

export function useDeleteLocality() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/localities/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.localities });
      qc.invalidateQueries({ queryKey: ['dashboardRecruits'] });
      qc.invalidateQueries({ queryKey: ['dashboardNational'] });
      qc.invalidateQueries({ queryKey: ['dashboardExecutive'] });
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
      qc.invalidateQueries({ queryKey: qk.recruitDesignations(args.localityId) });
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
          | 'RECRUITMENT_TO_START'
          | 'RECRUITMENT_STARTED'
          | 'DISMISSED'
          | 'ASSIGNED_TO_OM';
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
      qc.invalidateQueries({ queryKey: ['localities', 'recruitMembers', args.localityId] });
      qc.invalidateQueries({ queryKey: qk.recruitDesignations(args.localityId) });
      qc.invalidateQueries({ queryKey: qk.localities });
      qc.invalidateQueries({ queryKey: ['dashboardRecruits'] });
      qc.invalidateQueries({ queryKey: ['dashboardNational'] });
      qc.invalidateQueries({ queryKey: ['dashboardExecutive'] });
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
      qc.invalidateQueries({ queryKey: ['dashboardRecruits'] });
      qc.invalidateQueries({ queryKey: ['dashboardNational'] });
      qc.invalidateQueries({ queryKey: ['dashboardExecutive'] });
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

export function useImportBiSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { file: File; replace?: boolean }) => {
      const form = new FormData();
      form.append("file", args.file);
      if (typeof args.replace === "boolean") {
        form.append("replace", String(args.replace));
      }
      return (await api.post("/bi/surveys/import", form)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["biSurvey"] });
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
