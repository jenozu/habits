import { endOfZonedDay, historicalCompletionInstant } from "./date";
import type {
  AppSettings,
  ISODate,
  RoutineCheckIn,
  RoutineDefinition,
  TaskCheckIn,
  TaskSnapshot,
} from "../types/domain";

export function taskSnapshots(routine: RoutineDefinition): TaskSnapshot[] {
  return routine.tasks
    .filter((task) => !task.archivedAt)
    .sort((left, right) => left.order - right.order)
    .map(({ id, label, order, required, countsTowardProgress, type, targetMinutes }) => ({
      id, label, order, required, countsTowardProgress, type, targetMinutes,
    }));
}

export function calculateRoutineResult(
  snapshots: TaskSnapshot[],
  taskCheckIns: TaskCheckIn[],
  rule: RoutineDefinition["completionRule"],
): { completionPercent: number; completed: boolean } {
  const scored = snapshots.filter((task) => task.countsTowardProgress);
  const checkInMap = new Map(taskCheckIns.map((checkIn) => [checkIn.taskId, checkIn]));
  const taskCompleted = (task: TaskSnapshot) => {
    const value = checkInMap.get(task.id);
    if (task.type === "stopwatch" || task.type === "countdown" || task.type === "manualMinutes") {
      const target = task.targetMinutes ?? 1;
      return (value?.minutes ?? 0) >= target;
    }
    return value?.completed === true;
  };
  const completedCount = scored.filter(taskCompleted).length;
  const completionPercent = scored.length ? Math.round((completedCount / scored.length) * 100) : 0;
  const totalMinutes = taskCheckIns.reduce((sum, value) => sum + (value.minutes ?? 0), 0);

  let completed: boolean;
  switch (rule.type) {
    case "allRequired": {
      const required = snapshots.filter((task) => task.required);
      completed = required.length === 0 ? completionPercent === 100 : required.every(taskCompleted);
      break;
    }
    case "percentage": completed = completionPercent >= rule.threshold; break;
    case "count": completed = completedCount >= rule.requiredCount; break;
    case "duration": completed = totalMinutes >= rule.targetMinutes; break;
  }
  return { completionPercent, completed };
}

export function createCheckIn(
  routine: RoutineDefinition,
  date: ISODate,
  due: boolean,
  manuallyActivated: boolean,
  now = new Date(),
): RoutineCheckIn {
  const snapshots = taskSnapshots(routine);
  const result = calculateRoutineResult(snapshots, [], routine.completionRule);
  return {
    id: crypto.randomUUID(),
    routineId: routine.id,
    routineName: routine.name,
    date,
    due,
    manuallyActivated,
    taskSnapshots: snapshots,
    taskCheckIns: [],
    completionRule: routine.completionRule,
    graceMinutes: routine.graceMinutes,
    ...result,
    updatedAt: now.toISOString(),
  };
}

export function updateTaskCompletion(
  checkIn: RoutineCheckIn,
  taskId: string,
  completed: boolean,
  settings: AppSettings,
  now = new Date(),
  historicalEdit = false,
): RoutineCheckIn {
  const completedAt = completed
    ? historicalEdit
      ? historicalCompletionInstant(checkIn.date, settings.timeZone)
      : now.toISOString()
    : undefined;
  const current = checkIn.taskCheckIns.find((value) => value.taskId === taskId);
  const taskCheckIns = current
    ? checkIn.taskCheckIns.map((value) => value.taskId === taskId ? { ...value, completed, completedAt } : value)
    : [...checkIn.taskCheckIns, { taskId, completed, completedAt }];
  const result = calculateRoutineResult(checkIn.taskSnapshots, taskCheckIns, checkIn.completionRule);
  return {
    ...checkIn,
    taskCheckIns,
    ...result,
    finalizedAt: result.completed ? completedAt : undefined,
    updatedAt: now.toISOString(),
  };
}

export function routineCompletionWithinGrace(checkIn: RoutineCheckIn, settings: AppSettings): boolean {
  if (!checkIn.completed) return false;
  const deadline = endOfZonedDay(checkIn.date, settings.timeZone).getTime() + checkIn.graceMinutes * 60_000;
  const relevant = checkIn.taskCheckIns.filter((task) => task.completed && task.completedAt);
  if (!relevant.length) return checkIn.finalizedAt ? new Date(checkIn.finalizedAt).getTime() <= deadline : false;
  return Math.max(...relevant.map((task) => new Date(task.completedAt!).getTime())) <= deadline;
}

export function routineProgress(checkIn: RoutineCheckIn | undefined): number {
  return checkIn?.completionPercent ?? 0;
}
