import type { AppStateV3, AppStateV4 } from "../types/domain";

const scheduleTypes = new Set(["daily", "weekdays", "timesPerWeek", "interval", "specificDates", "manual"]);
const completionTypes = new Set(["allRequired", "percentage", "count", "duration"]);

function validateSharedState(value: unknown, schemaVersion: 3 | 4): value is AppStateV3 | AppStateV4 {
  if (!value || typeof value !== "object") return false;
  const state = value as Record<string, unknown>;
  if (state.schemaVersion !== schemaVersion || !Array.isArray(state.routines) || !Array.isArray(state.checkIns) || !Array.isArray(state.journalEntries) || !Array.isArray(state.attachments)) return false;
  if (!state.settings || typeof state.settings !== "object") return false;
  const settings = state.settings as Record<string, unknown>;
  if (typeof settings.timeZone !== "string" || typeof settings.weekStartsOn !== "number" || settings.weekStartsOn < 0 || settings.weekStartsOn > 6) return false;
  if (!state.routines.every((item) => {
    if (!item || typeof item !== "object") return false;
    const routine = item as Record<string, unknown>;
    const schedule = routine.schedule as Record<string, unknown> | undefined;
    const completion = routine.completionRule as Record<string, unknown> | undefined;
    return typeof routine.id === "string" && typeof routine.name === "string" && Array.isArray(routine.tasks) && scheduleTypes.has(String(schedule?.type)) && completionTypes.has(String(completion?.type));
  })) return false;
  return ["legacyDailySnapshots", "badges", "inAppNotifications", "reportSnapshots"].every((key) => Array.isArray(state[key]));
}

export function validateV3State(value: unknown): value is AppStateV3 {
  return validateSharedState(value, 3);
}

export function validateAppState(value: unknown): value is AppStateV4 {
  if (!validateSharedState(value, 4)) return false;
  const state = value as unknown as Record<string, unknown>;
  if (!Array.isArray(state.standaloneTasks)) return false;
  return state.standaloneTasks.every((item) => {
    if (!item || typeof item !== "object") return false;
    const task = item as Record<string, unknown>;
    return typeof task.id === "string" &&
      typeof task.title === "string" &&
      ["low", "normal", "high"].includes(String(task.priority)) &&
      typeof task.createdAt === "string" &&
      typeof task.updatedAt === "string" &&
      (task.dueDate === undefined || typeof task.dueDate === "string") &&
      (task.dueTime === undefined || typeof task.dueTime === "string") &&
      (task.completedAt === undefined || typeof task.completedAt === "string") &&
      (task.deletedAt === undefined || typeof task.deletedAt === "string");
  });
}
