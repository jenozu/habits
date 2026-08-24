import { overdueTasks, taskGroup, taskProgressForDate, tasksInWeek, updateStandaloneTaskCompletion } from "../lib/standalone-tasks";
import type { StandaloneTask } from "../types/domain";

function task(overrides: Partial<StandaloneTask> = {}): StandaloneTask {
  return {
    id: "task-1",
    title: "Book appointment",
    priority: "normal",
    createdAt: "2026-08-20T12:00:00.000Z",
    updatedAt: "2026-08-20T12:00:00.000Z",
    ...overrides,
  };
}

describe("standalone tasks", () => {
  it("groups dated and anytime tasks without treating them as routine steps", () => {
    expect(taskGroup(task({ dueDate: "2026-08-23" }), "2026-08-24")).toBe("overdue");
    expect(taskGroup(task({ dueDate: "2026-08-24" }), "2026-08-24")).toBe("today");
    expect(taskGroup(task({ dueDate: "2026-08-25" }), "2026-08-24")).toBe("upcoming");
    expect(taskGroup(task(), "2026-08-24")).toBe("anytime");
  });

  it("uses the configured week start for weekly task selection", () => {
    const tasks = [
      task({ id: "sun", dueDate: "2026-08-23" }),
      task({ id: "mon", dueDate: "2026-08-24" }),
      task({ id: "next-mon", dueDate: "2026-08-31" }),
    ];
    expect(tasksInWeek(tasks, "2026-08-24", 1).map((value) => value.id)).toEqual(["mon"]);
    expect(tasksInWeek(tasks, "2026-08-24", 0).map((value) => value.id)).toEqual(["sun", "mon"]);
  });

  it("excludes completed and deleted work from overdue results", () => {
    const tasks = [
      task({ id: "open", dueDate: "2026-08-23" }),
      task({ id: "done", dueDate: "2026-08-23", completedAt: "2026-08-23T15:00:00.000Z" }),
      task({ id: "deleted", dueDate: "2026-08-23", deletedAt: "2026-08-23T16:00:00.000Z" }),
    ];
    expect(overdueTasks(tasks, "2026-08-24").map((value) => value.id)).toEqual(["open"]);
  });

  it("tracks daily task progress independently", () => {
    const now = new Date("2026-08-24T14:00:00.000Z");
    const open = task({ id: "open", dueDate: "2026-08-24" });
    const done = updateStandaloneTaskCompletion(task({ id: "done", dueDate: "2026-08-24" }), true, now);
    expect(taskProgressForDate([open, done], "2026-08-24")).toEqual({ complete: 1, total: 2, percent: 50 });
    expect(updateStandaloneTaskCompletion(done, false, now).completedAt).toBeUndefined();
  });
});
