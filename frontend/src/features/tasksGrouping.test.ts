import { describe, expect, it } from "vitest";
import { buildTaskGroupingMetaByTaskId } from "./tasksGrouping";

function resolveLocalityName(task: any) {
  return String(task?.localityName ?? task?.localityId ?? "-");
}

function resolveTitle(task: any) {
  return String(task?.title ?? task?.taskTemplate?.title ?? "").trim();
}

describe("tasksGrouping helpers", () => {
  it("preserva uma linha por tarefa e ainda vincula grupos explícitos para o drawer", () => {
    const metaByTaskId = buildTaskGroupingMetaByTaskId(
      [
        {
          id: "task-1",
          title: "Inspecionar OM",
          localityId: "loc-1",
          localityName: "BACO",
          dueDate: "2026-04-23T00:00:00.000Z",
          groupKey: "group-1",
        },
        {
          id: "task-2",
          title: "Inspecionar OM",
          localityId: "loc-2",
          localityName: "BABR",
          dueDate: "2026-04-24T00:00:00.000Z",
          groupKey: "group-1",
        },
      ],
      resolveLocalityName,
      resolveTitle,
    );

    expect(metaByTaskId.get("task-1")).toMatchObject({
      primaryTaskId: "task-1",
      linkedTaskIds: ["task-1", "task-2"],
      linkedLocalityCount: 2,
    });
    expect(metaByTaskId.get("task-2")).toMatchObject({
      primaryTaskId: "task-1",
      linkedTaskIds: ["task-1", "task-2"],
      linkedLocalityCount: 2,
    });
  });

  it("mantém compatibilidade com vínculos legados sem colapsar a listagem", () => {
    const metaByTaskId = buildTaskGroupingMetaByTaskId(
      [
        {
          id: "task-legacy-1",
          title: "Revisar processo",
          taskTemplateId: "tpl-1",
          taskTemplate: { id: "tpl-1", phaseId: "phase-1" },
          localityId: "loc-1",
          localityName: "BACO",
          scope: "SMIF",
          createdAt: "2026-04-23T10:00:00.000Z",
          dueDate: "2026-04-26T00:00:00.000Z",
        },
        {
          id: "task-legacy-2",
          title: "Revisar processo",
          taskTemplateId: "tpl-1",
          taskTemplate: { id: "tpl-1", phaseId: "phase-1" },
          localityId: "loc-2",
          localityName: "BABR",
          scope: "SMIF",
          createdAt: "2026-04-23T11:00:00.000Z",
          dueDate: "2026-04-27T00:00:00.000Z",
        },
      ],
      resolveLocalityName,
      resolveTitle,
    );

    expect(metaByTaskId.get("task-legacy-1")?.linkedTaskIds).toEqual([
      "task-legacy-1",
      "task-legacy-2",
    ]);
    expect(metaByTaskId.get("task-legacy-2")?.linkedLocalities).toEqual([
      { id: "loc-1", name: "BACO" },
      { id: "loc-2", name: "BABR" },
    ]);
  });
});
