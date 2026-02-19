import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { qk } from "./queryKeys";

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
        eventDate?: string | null;
        reportRequired?: boolean;
      };
    }) => (await api.put(`/activities/${args.id}`, args.payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activities"] }),
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

export function useUpsertActivityReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      payload: {
        date: string;
        location: string;
        responsible: string;
        missionSupport: string;
        introduction: string;
        missionObjectives: string;
        executionSchedule: string;
        activitiesPerformed: string;
        participantsCount: number;
        participantsCharacteristics: string;
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

export function useDashboardNational(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.dashboardNational(filters),
    queryFn: async () =>
      (await api.get(`/dashboard/national`, { params: filters })).data,
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
    queryFn: async () => (await api.get("/users")).data,
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
      roleId?: string | null;
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
    mutationFn: async (uid: string) =>
      (await api.get("/admin/rbac/ldap-user", { params: { uid } })).data,
  });
}

export function useUpsertLdapUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      uid: string;
      roleId: string;
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
export function useNotices(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.notices(filters),
    queryFn: async () => (await api.get("/notices", { params: filters })).data,
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

/** Meetings */
export function useMeetings(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.meetings(filters),
    queryFn: async () => (await api.get("/meetings", { params: filters })).data,
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

export function useOrgChartCandidates(filters: Record<string, any>, enabled = true) {
  return useQuery({
    queryKey: ['orgChart', 'candidates', filters],
    queryFn: async () => (await api.get('/org-chart/candidates', { params: filters })).data,
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
    }) => (await api.post('/org-chart/assignments', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orgChart'] });
      qc.invalidateQueries({ queryKey: ['elos'] });
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
    }) => (await api.put(`/org-chart/assignments/${args.id}`, args.payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orgChart'] });
      qc.invalidateQueries({ queryKey: ['elos'] });
    },
  });
}

export function useDeleteOrgChartAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/org-chart/assignments/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orgChart'] });
      qc.invalidateQueries({ queryKey: ['elos'] });
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

export function useLocalities(enabled = true) {
  return useQuery({
    queryKey: qk.localities,
    queryFn: async () => (await api.get("/localities")).data,
    enabled,
    staleTime: 60_000,
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
      qc.invalidateQueries({ queryKey: qk.dashboardRecruits });
      qc.invalidateQueries({ queryKey: ["dashboardNational"] });
      qc.invalidateQueries({ queryKey: ["dashboardExecutive"] });
    },
  });
}

export function useUpdateLocalityRecruits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      recruitsFemaleCountCurrent: number;
    }) =>
      (
        await api.put(`/localities/${args.id}/recruits`, {
          recruitsFemaleCountCurrent: args.recruitsFemaleCountCurrent,
        })
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.localities });
      qc.invalidateQueries({ queryKey: qk.dashboardRecruits });
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

export function useDocuments(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.documents(filters),
    queryFn: async () =>
      (await api.get("/documents", { params: filters })).data,
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
    queryFn: async () => (await api.get("/documents/links", { params: filters })).data,
    enabled: Boolean(filters.documentId || (filters.entityType && filters.entityId)),
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

export function useDashboardRecruits(enabled = true) {
  return useQuery({
    queryKey: qk.dashboardRecruits,
    queryFn: async () => (await api.get("/dashboard/recruits")).data,
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
    mutationFn: async (args: { file: File }) => {
      const form = new FormData();
      form.append("file", args.file);
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
