import { dateKeyAt, daysBetween, startOfWeek, weekday } from "./date";
import type { AppSettings, ISODate, RoutineCheckIn, RoutineDefinition } from "../types/domain";

function activeOnDate(routine: RoutineDefinition, date: ISODate, settings: AppSettings): boolean {
  if (date < dateKeyAt(new Date(routine.createdAt), settings.timeZone)) return false;
  if (!routine.archivedAt) return true;
  return dateKeyAt(new Date(routine.archivedAt), settings.timeZone) > date;
}

function checkInFor(routineId: string, date: ISODate, checkIns: RoutineCheckIn[]) {
  return checkIns.find((checkIn) => checkIn.routineId === routineId && checkIn.date === date);
}

export function completionsInConfiguredWeek(
  routineId: string,
  date: ISODate,
  checkIns: RoutineCheckIn[],
  settings: AppSettings,
): number {
  const weekStart = startOfWeek(date, settings.weekStartsOn);
  return checkIns.filter(
    (checkIn) =>
      checkIn.routineId === routineId &&
      checkIn.date >= weekStart &&
      checkIn.date < startOfWeekOffset(weekStart) &&
      checkIn.completed,
  ).length;
}

function startOfWeekOffset(weekStart: ISODate): ISODate {
  const date = new Date(`${weekStart}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 7);
  return date.toISOString().slice(0, 10);
}

export function isRoutineDue(
  routine: RoutineDefinition,
  date: ISODate,
  checkIns: RoutineCheckIn[],
  settings: AppSettings,
): boolean {
  const existing = checkInFor(routine.id, date, checkIns);
  if (existing?.due) return true;
  if (!activeOnDate(routine, date, settings)) return false;
  switch (routine.schedule.type) {
    case "daily":
      return true;
    case "weekdays":
      return routine.schedule.days.includes(weekday(date));
    case "timesPerWeek":
      return existing?.due === true && completionsInConfiguredWeek(routine.id, date, checkIns, settings) <= routine.schedule.count;
    case "manual":
      return existing?.due === true;
    case "interval": {
      const interval = routine.schedule.every * (routine.schedule.unit === "week" ? 7 : 1);
      const difference = daysBetween(routine.schedule.anchorDate, date);
      return difference >= 0 && difference % interval === 0;
    }
    case "specificDates":
      return routine.schedule.dates.includes(date);
  }
}

export function isRoutineAvailable(
  routine: RoutineDefinition,
  date: ISODate,
  checkIns: RoutineCheckIn[],
  settings: AppSettings,
): boolean {
  if (!activeOnDate(routine, date, settings) || isRoutineDue(routine, date, checkIns, settings)) return false;
  if (routine.schedule.type === "manual") return true;
  if (routine.schedule.type === "timesPerWeek") {
    return completionsInConfiguredWeek(routine.id, date, checkIns, settings) < routine.schedule.count;
  }
  return false;
}

export function scheduleLabel(schedule: RoutineDefinition["schedule"]): string {
  switch (schedule.type) {
    case "daily": return "Every day";
    case "weekdays": return schedule.days.length ? `Selected days: ${schedule.days.map((day) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]).join(", ")}` : "No weekdays selected";
    case "timesPerWeek": return `${schedule.count} time${schedule.count === 1 ? "" : "s"} per week`;
    case "interval": return `Every ${schedule.every} ${schedule.unit}${schedule.every === 1 ? "" : "s"}`;
    case "specificDates": return `${schedule.dates.length} specific date${schedule.dates.length === 1 ? "" : "s"}`;
    case "manual": return "Only when activated";
  }
}
