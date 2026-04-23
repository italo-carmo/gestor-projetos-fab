export type TaskGroupingLocality = {
  id: string;
  name: string;
};

export type TaskGroupingMeta = {
  primaryTaskId: string;
  linkedTaskIds: string[];
  linkedLocalities: TaskGroupingLocality[];
  linkedLocalityCount: number;
};

function resolveFallbackLegacyGroupKey(
  task: any,
  resolveTitle: (task: any) => string,
) {
  const createdDateKey =
    String(task?.createdAt ?? "").slice(0, 10) ||
    String(task?.dueDate ?? "").slice(0, 10);
  const phaseKey = String(task?.taskTemplate?.phaseId ?? "");
  const templateKey = String(
    task?.taskTemplateId ?? task?.taskTemplate?.id ?? "",
  );
  const meetingKey = String(task?.meetingId ?? "");
  const specialtyKey = String(task?.specialtyId ?? "");
  const eloRoleKey = String(task?.eloRoleId ?? "");
  const scopeKey = String(task?.scope ?? "SMIF").trim();
  const titleKey = resolveTitle(task).trim().toLowerCase();
  return `legacy:${scopeKey}|${templateKey}|${titleKey}|${phaseKey}|${createdDateKey}|${meetingKey}|${specialtyKey}|${eloRoleKey}`;
}

function buildTaskGroupingLocalities(
  tasks: any[],
  resolveLocalityName: (task: any) => string,
) {
  const localityMap = new Map<string, TaskGroupingLocality>();

  tasks.forEach((task) => {
    const id = String(task?.localityId ?? "").trim();
    if (!id || localityMap.has(id)) return;
    localityMap.set(id, {
      id,
      name: resolveLocalityName(task),
    });
  });

  return Array.from(localityMap.values());
}

export function buildTaskGroupingMetaByTaskId(
  tasks: any[],
  resolveLocalityName: (task: any) => string,
  resolveTitle: (task: any) => string,
) {
  const groups = new Map<string, any[]>();

  tasks.forEach((task) => {
    const explicitGroupKey = String(task?.groupKey ?? "").trim();
    const groupKey =
      explicitGroupKey || resolveFallbackLegacyGroupKey(task, resolveTitle);
    const current = groups.get(groupKey) ?? [];
    current.push(task);
    groups.set(groupKey, current);
  });

  const metaByTaskId = new Map<string, TaskGroupingMeta>();

  groups.forEach((group) => {
    const ordered = [...group].sort(
      (left: any, right: any) =>
        new Date(left?.dueDate ?? 0).getTime() -
        new Date(right?.dueDate ?? 0).getTime(),
    );
    const linkedTaskIds = ordered.map((task: any) =>
      String(task?.id ?? "").trim(),
    );
    const linkedLocalities = buildTaskGroupingLocalities(
      ordered,
      resolveLocalityName,
    );
    const meta: TaskGroupingMeta = {
      primaryTaskId: linkedTaskIds[0] ?? "",
      linkedTaskIds,
      linkedLocalities,
      linkedLocalityCount: linkedLocalities.length || 1,
    };

    ordered.forEach((task: any) => {
      const taskId = String(task?.id ?? "").trim();
      if (!taskId) return;
      metaByTaskId.set(taskId, meta);
    });
  });

  return metaByTaskId;
}
