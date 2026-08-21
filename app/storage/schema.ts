import type { AppStateV3 } from "../types/domain";

const scheduleTypes = new Set(["daily", "weekdays", "timesPerWeek", "interval", "specificDates", "manual"]);
const completionTypes = new Set(["allRequired", "percentage", "count", "duration"]);

export function validateAppState(value: unknown): value is AppStateV3 {
  if (!value || typeof value !== "object") return false;
  const state = value as Record<string, unknown>;
  if (state.schemaVersion !== 3 || !Array.isArray(state.routines) || !Array.isArray(state.checkIns) || !Array.isArray(state.journalEntries) || !Array.isArray(state.attachments)) return false;
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
