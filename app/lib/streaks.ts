import { addDays, endOfZonedDay } from "./date";
import { routineCompletionWithinGrace } from "./completion";
import { isRoutineDue } from "./schedules";
import type { AppState, ISODate, RoutineCheckIn } from "../types/domain";

export type DayStatus = "success" | "failure" | "provisional" | "neutral";

function dueCheckInsForDate(state: AppState, date: ISODate): RoutineCheckIn[] {
  return state.routines
    .filter((routine) => isRoutineDue(routine, date, state.checkIns, state.settings))
    .map((routine) => state.checkIns.find((checkIn) => checkIn.routineId === routine.id && checkIn.date === date))
    .filter((checkIn): checkIn is RoutineCheckIn => Boolean(checkIn));
}

export function evaluateDay(state: AppState, date: ISODate, now = new Date()): DayStatus {
  const dueRoutines = state.routines.filter((routine) => isRoutineDue(routine, date, state.checkIns, state.settings));
  if (dueRoutines.length === 0) {
    const legacy = state.legacyDailySnapshots.find((snapshot) => snapshot.date === date);
    if (legacy) return legacy.completionPercent >= 100 ? "success" : "failure";
    return "neutral";
  }
  const checkIns = dueCheckInsForDate(state, date);
  const completedIds = new Set(checkIns.filter((checkIn) => routineCompletionWithinGrace(checkIn, state.settings)).map((checkIn) => checkIn.routineId));
  const latestDeadline = Math.max(...dueRoutines.map((routine) => endOfZonedDay(date, state.settings.timeZone).getTime() + routine.graceMinutes * 60_000));

  let successful: boolean;
  switch (state.settings.successfulDayRule.type) {
    case "allDueRoutines":
      successful = dueRoutines.every((routine) => completedIds.has(routine.id));
      break;
    case "percentage":
      successful = (completedIds.size / dueRoutines.length) * 100 >= state.settings.successfulDayRule.threshold;
      break;
    case "selectedRoutines": {
      const selectedDue = dueRoutines.filter((routine) => state.settings.successfulDayRule.type === "selectedRoutines" && state.settings.successfulDayRule.routineIds.includes(routine.id));
      if (!selectedDue.length) return "neutral";
      successful = selectedDue.every((routine) => completedIds.has(routine.id));
      break;
    }
  }
  if (successful) return "success";
  return now.getTime() <= latestDeadline ? "provisional" : "failure";
}

export function calculateOverallStreak(state: AppState, today: ISODate, now = new Date()): number {
  let streak = 0;
  let date = today;
  for (let count = 0; count < 366; count += 1) {
    const status = evaluateDay(state, date, now);
    if (status === "failure") break;
    if (status === "success") streak += 1;
    date = addDays(date, -1);
  }
  return streak;
}

export function dueProgressForDate(state: AppState, date: ISODate) {
  const due = state.routines.filter((routine) => isRoutineDue(routine, date, state.checkIns, state.settings));
  if (!due.length) return { complete: 0, total: 0, percent: 0, neutral: true };
  const completed = due.filter((routine) => {
    const checkIn = state.checkIns.find((value) => value.routineId === routine.id && value.date === date);
    return checkIn?.completed === true;
  }).length;
  return { complete: completed, total: due.length, percent: Math.round((completed / due.length) * 100), neutral: false };
}
