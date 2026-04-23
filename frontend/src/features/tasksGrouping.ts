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

function normalizeTaskId(task: any) {
  return String(task?.id ?? "").trim();
}

function buildGroupedComments(tasks: any[]) {
  return tasks.reduce(
    (acc, task) => {
      acc.total += Math.max(0, Number(task?.comments?.total ?? 0) || 0);
      acc.unread += Math.max(0, Number(task?.comments?.unread ?? 0) || 0);
      return acc;
    },
    { total: 0, unread: 0 },
  );
}

function resolveGroupedStatus(tasks: any[]) {
  const statuses = Array.from(
    new Set(
      tasks
        .map((task) => String(task?.status ?? "").trim())
        .filter(Boolean),
    ),
  );

  if (statuses.length <= 1) {
    return statuses[0] ?? "NOT_STARTED";
  }
  if (statuses.every((status) => status === "DONE")) {
    return "DONE";
  }
  if (statuses.every((status) => status === "NOT_STARTED")) {
    return "NOT_STARTED";
  }
  if (statuses.includes("IN_PROGRESS")) {
    return "IN_PROGRESS";
  }
  if (statuses.includes("STARTED")) {
    return "STARTED";
  }
  if (statuses.includes("DONE")) {
    return "IN_PROGRESS";
  }
  return statuses[0] ?? "NOT_STARTED";
}

function resolveGroupedProgress(tasks: any[]) {
  const values = tasks
    .map((task) => Number(task?.progressPercent))
    .filter((value) => Number.isFinite(value));
  if (values.length === 0) {
    return 0;
  }
  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
}

function resolveGroupedAssignee(tasks: any[]) {
  const labels = Array.from(
    new Set(
      tasks
        .map((task) =>
          String(
            task?.assignee?.label ??
              task?.assignee?.name ??
              task?.assignedTo?.name ??
              task?.assignedTo?.email ??
              "",
          ).trim(),
        )
        .filter(Boolean),
    ),
  );

  if (labels.length <= 1) {
    return tasks[0]?.assignee ?? tasks[0]?.assignedTo ?? null;
  }

  return {
    label: "Múltiplos",
    name: "Múltiplos",
  };
}

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

export function buildGroupedTaskRows(
  tasks: any[],
  resolveLocalityName: (task: any) => string,
  resolveTitle: (task: any) => string,
) {
  const metaByTaskId = buildTaskGroupingMetaByTaskId(
    tasks,
    resolveLocalityName,
    resolveTitle,
  );
  const taskById = new Map(
    tasks
      .map((task) => [normalizeTaskId(task), task] as const)
      .filter(([taskId]) => Boolean(taskId)),
  );

  const rows = tasks.flatMap((task) => {
    const taskId = normalizeTaskId(task);
    if (!taskId) return [];

    const groupMeta = metaByTaskId.get(taskId);
    const primaryTaskId = String(groupMeta?.primaryTaskId ?? taskId).trim();
    if (primaryTaskId !== taskId) {
      return [];
    }

    const groupedTaskIds = groupMeta?.linkedTaskIds ?? [taskId];
    const groupedTasks = groupedTaskIds
      .map((id) => taskById.get(String(id)))
      .filter(Boolean);
    const primaryTask = groupedTasks[0] ?? task;
    const comments = buildGroupedComments(groupedTasks);

    return [
      {
        ...primaryTask,
        id: primaryTaskId,
        primaryTaskId,
        status: resolveGroupedStatus(groupedTasks),
        progressPercent: resolveGroupedProgress(groupedTasks),
        assignee: resolveGroupedAssignee(groupedTasks),
        comments,
        isLate: groupedTasks.some((item) => Boolean(item?.isLate)),
        groupedTaskIds,
        groupedLocalities: groupMeta?.linkedLocalities ?? [
          {
            id: String(primaryTask?.localityId ?? ""),
            name: resolveLocalityName(primaryTask),
          },
        ],
        groupedLocalityCount: Math.max(
          1,
          Number(groupMeta?.linkedLocalityCount ?? 1) || 1,
        ),
        localityName: resolveTaskLocalityNameFromGroupedTasks(
          groupedTasks,
          resolveLocalityName,
        ),
      },
    ];
  });

  return {
    rows,
    metaByTaskId,
  };
}

function resolveTaskLocalityNameFromGroupedTasks(
  tasks: any[],
  resolveLocalityName: (task: any) => string,
) {
  const names = Array.from(
    new Set(tasks.map((task) => resolveLocalityName(task)).filter(Boolean)),
  );

  if (names.length === 0) {
    return "-";
  }
  if (names.length === 1) {
    return names[0];
  }
  return `${names[0]} +${names.length - 1}`;
}
