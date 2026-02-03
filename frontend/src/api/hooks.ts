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
    mutationFn: async (args: { email: string; password: string }) =>
      (await api.post('/auth/login', args)).data,
  });
}

export function useTasks(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.tasks(filters),
    queryFn: async () => (await api.get("/task-instances", { params: filters })).data,
    staleTime: 15_000,
  });
}

export function useUpdateTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; status: string }) =>
      (await api.put(`/task-instances/${args.id}/status`, { status: args.status })).data,
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
      (await api.put(`/task-instances/${args.id}/progress`, { progressPercent: args.progressPercent })).data,
    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const snapshots = qc.getQueriesData({ queryKey: ["tasks"] });
      snapshots.forEach(([key, data]: any) => {
        if (!data?.items) return;
        qc.setQueryData(key, {
          ...data,
          items: data.items.map((item: any) =>
            item.id === args.id ? { ...item, progressPercent: args.progressPercent } : item,
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
    mutationFn: async (args: { id: string; assignedToId: string | null }) =>
      (await api.put(`/task-instances/${args.id}/assign`, { assignedToId: args.assignedToId })).data,
    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const snapshots = qc.getQueriesData({ queryKey: ["tasks"] });
      snapshots.forEach(([key, data]: any) => {
        if (!data?.items) return;
        qc.setQueryData(key, {
          ...data,
          items: data.items.map((item: any) =>
            item.id === args.id ? { ...item, assignedToId: args.assignedToId } : item,
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

export function useGantt(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.gantt(filters),
    queryFn: async () => (await api.get("/task-instances/gantt", { params: filters })).data,
  });
}

export function useCalendarYear(year: number, filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.calendarYear(year, filters),
    queryFn: async () => (await api.get("/task-instances/calendar", { params: { year, ...filters } })).data,
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
    queryFn: async () => (await api.get(`/dashboard/national`, { params: filters })).data,
    staleTime: 15_000,
  });
}

export function usePhases() {
  return useQuery({
    queryKey: ['phases'],
    queryFn: async () => (await api.get('/phases')).data,
  });
}

export function useTaskTemplates() {
  return useQuery({
    queryKey: qk.taskTemplates,
    queryFn: async () => (await api.get('/task-templates')).data,
  });
}

/** RBAC Admin */
export function useRoles() {
  return useQuery({
    queryKey: qk.roles,
    queryFn: async () => (await api.get("/roles")).data,
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
    queryKey: ["admin","rbac","export"],
    queryFn: async () => (await api.get("/admin/rbac/export")).data,
  });
}

export function useRbacImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { payload: any; mode?: "replace"|"merge" }) =>
      (await api.post("/admin/rbac/import", args.payload, { params: { mode: args.mode ?? "replace" } })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.roles });
      qc.invalidateQueries({ queryKey: ["admin","rbac","export"] });
    },
  });
}

export function useUploadReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { taskInstanceId: string; file: File }) => {
      const form = new FormData();
      form.append('file', args.file);
      form.append('taskInstanceId', args.taskInstanceId);
      return (await api.post('/reports/upload', form)).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

/** Notices */
export function useNotices(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.notices(filters),
    queryFn: async () => (await api.get('/notices', { params: filters })).data,
    staleTime: 10_000,
  });
}

export function useCreateNotice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => (await api.post('/notices', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notices'] }),
  });
}

export function useUpdateNotice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; payload: any }) =>
      (await api.put(`/notices/${args.id}`, args.payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notices'] }),
  });
}

export function useDeleteNotice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/notices/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notices'] }),
  });
}

export function usePinNotice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; pinned: boolean }) =>
      (await api.patch(`/notices/${args.id}/pin`, { pinned: args.pinned })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notices'] }),
  });
}

/** Meetings */
export function useMeetings(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.meetings(filters),
    queryFn: async () => (await api.get('/meetings', { params: filters })).data,
    staleTime: 10_000,
  });
}

export function useCreateMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => (await api.post('/meetings', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meetings'] }),
  });
}

export function useUpdateMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; payload: any }) =>
      (await api.put(`/meetings/${args.id}`, args.payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meetings'] }),
  });
}

export function useAddMeetingDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; text: string }) =>
      (await api.post(`/meetings/${args.id}/decisions`, { text: args.text })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meetings'] }),
  });
}

export function useGenerateMeetingTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; payload: any }) =>
      (await api.post(`/meetings/${args.id}/generate-tasks`, args.payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meetings'] }),
  });
}

/** Checklists */
export function useChecklists(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.checklists(filters),
    queryFn: async () => (await api.get('/checklists', { params: filters })).data,
    staleTime: 10_000,
  });
}

export function useCreateChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => (await api.post('/checklists', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklists'] }),
  });
}

export function useAddChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; payload: any }) =>
      (await api.post(`/checklists/${args.id}/items`, args.payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklists'] }),
  });
}

export function useUpdateChecklistStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { updates: any[] }) =>
      (await api.put('/checklist-item-status/batch', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklists'] }),
  });
}

/** Elos + Org Chart */
export function useElos(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.elos(filters),
    queryFn: async () => (await api.get('/elos', { params: filters })).data,
    staleTime: 10_000,
  });
}

export function useCreateElo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => (await api.post('/elos', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['elos'] }),
  });
}

export function useUpdateElo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; payload: any }) =>
      (await api.put(`/elos/${args.id}`, args.payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['elos'] }),
  });
}

export function useDeleteElo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/elos/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['elos'] }),
  });
}

export function useOrgChart(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.orgChart(filters),
    queryFn: async () => (await api.get('/org-chart', { params: filters })).data,
    staleTime: 15_000,
  });
}

/** Audit logs */
export function useAuditLogs(filters: Record<string, any>) {
  return useQuery({
    queryKey: qk.auditLogs(filters),
    queryFn: async () => (await api.get('/audit-logs', { params: filters })).data,
    staleTime: 10_000,
  });
}

export function useLocalities() {
  return useQuery({
    queryKey: qk.localities,
    queryFn: async () => (await api.get('/localities')).data,
    staleTime: 60_000,
  });
}

export function useSpecialties() {
  return useQuery({
    queryKey: qk.specialties,
    queryFn: async () => (await api.get('/specialties')).data,
    staleTime: 60_000,
  });
}
