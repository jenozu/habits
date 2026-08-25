import type { AppState, RoutineCheckIn, RoutineDefinition } from "../types/domain";
import { DEFAULT_SETTINGS } from "../types/domain";
import { createCheckIn, updateTaskCompletion } from "../lib/completion";

export function routine(overrides: Partial<RoutineDefinition> = {}): RoutineDefinition {
  return {
    id: "routine-1", name: "Routine", areaId: "Personal", icon: "◆", schedule: { type: "daily" },
    completionRule: { type: "allRequired" }, graceMinutes: 0, sortOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    tasks: [{ id: "task-1", label: "Task", order: 0, required: true, countsTowardProgress: true, type: "check" }],
    ...overrides,
  };
}

export function completedCheckIn(definition: RoutineDefinition, date: string, completedAt = `${date}T16:00:00.000Z`): RoutineCheckIn {
  const initial = createCheckIn(definition, date, true, definition.schedule.type === "manual", new Date(completedAt));
  return updateTaskCompletion(initial, definition.tasks[0].id, true, { ...DEFAULT_SETTINGS }, new Date(completedAt), false);
}

export function state(routines: RoutineDefinition[], checkIns: RoutineCheckIn[] = []): AppState {
  return { schemaVersion: 5, routines, checkIns, standaloneTasks: [], journalEntries: [], attachments: [], settings: { ...DEFAULT_SETTINGS }, legacyDailySnapshots: [], badges: [], inAppNotifications: [], reportSnapshots: [] };
}
