import { weekDates } from "./date";
import type { ISODate, StandaloneTask } from "../types/domain";

export type StandaloneTaskGroup = "overdue" | "today" | "upcoming" | "anytime" | "completed";

export function activeStandaloneTasks(tasks: StandaloneTask[]): StandaloneTask[] {
  return tasks.filter((task) => !task.deletedAt);
}

export function taskGroup(task: StandaloneTask, date: ISODate): StandaloneTaskGroup {
  if (task.completedAt) return "completed";
  if (!task.dueDate) return "anytime";
  if (task.dueDate < date) return "overdue";
  if (task.dueDate === date) return "today";
  return "upcoming";
}

export function tasksForDate(tasks: StandaloneTask[], date: ISODate): StandaloneTask[] {
  return activeStandaloneTasks(tasks)
    .filter((task) => task.dueDate === date)
    .sort(compareStandaloneTasks);
}

export function overdueTasks(tasks: StandaloneTask[], date: ISODate): StandaloneTask[] {
  return activeStandaloneTasks(tasks)
    .filter((task) => !task.completedAt && Boolean(task.dueDate) && task.dueDate! < date)
    .sort(compareStandaloneTasks);
}

export function tasksInWeek(tasks: StandaloneTask[], date: ISODate, weekStartsOn: number): StandaloneTask[] {
  const dates = new Set(weekDates(date, weekStartsOn));
  return activeStandaloneTasks(tasks)
    .filter((task) => Boolean(task.dueDate) && dates.has(task.dueDate!))
    .sort(compareStandaloneTasks);
}

export function taskProgressForDate(tasks: StandaloneTask[], date: ISODate) {
  const due = tasksForDate(tasks, date);
  const complete = due.filter((task) => Boolean(task.completedAt)).length;
  return {
    complete,
    total: due.length,
    percent: due.length ? Math.round((complete / due.length) * 100) : 0,
  };
}

export function updateStandaloneTaskCompletion(task: StandaloneTask, completed: boolean, now = new Date()): StandaloneTask {
  return {
    ...task,
    completedAt: completed ? now.toISOString() : undefined,
    updatedAt: now.toISOString(),
  };
}

export function compareStandaloneTasks(left: StandaloneTask, right: StandaloneTask): number {
  const priority = { high: 0, normal: 1, low: 2 } as const;
  if (left.completedAt && !right.completedAt) return 1;
  if (!left.completedAt && right.completedAt) return -1;
  if ((left.dueDate ?? "9999-12-31") !== (right.dueDate ?? "9999-12-31")) {
    return (left.dueDate ?? "9999-12-31").localeCompare(right.dueDate ?? "9999-12-31");
  }
  if ((left.dueTime ?? "23:59") !== (right.dueTime ?? "23:59")) {
    return (left.dueTime ?? "23:59").localeCompare(right.dueTime ?? "23:59");
  }
  if (priority[left.priority] !== priority[right.priority]) return priority[left.priority] - priority[right.priority];
  return left.createdAt.localeCompare(right.createdAt);
}
