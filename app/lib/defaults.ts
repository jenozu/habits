import { DEFAULT_SETTINGS, type AppState, type RoutineDefinition } from "../types/domain";

export function defaultRoutines(now = new Date()): RoutineDefinition[] {
  const timestamp = now.toISOString();
  return [
    {
      id: crypto.randomUUID(), name: "Morning routine", areaId: "Personal", icon: "☀",
      schedule: { type: "daily" }, completionRule: { type: "allRequired" }, graceMinutes: 0,
      nextAction: "Finish before starting work", sortOrder: 0, createdAt: timestamp, updatedAt: timestamp,
      tasks: [
        { id: crypto.randomUUID(), label: "Review today’s priorities", order: 0, required: true, countsTowardProgress: true, type: "check" },
        { id: crypto.randomUUID(), label: "Take supplements", order: 1, required: true, countsTowardProgress: true, type: "check" },
      ],
    },
    {
      id: crypto.randomUUID(), name: "Evening routine", areaId: "Personal", icon: "☾",
      schedule: { type: "daily" }, completionRule: { type: "allRequired" }, graceMinutes: 60,
      nextAction: "Close the day with a short reflection", sortOrder: 1, createdAt: timestamp, updatedAt: timestamp,
      tasks: [
        { id: crypto.randomUUID(), label: "Review the day", order: 0, required: true, countsTowardProgress: true, type: "check" },
        { id: crypto.randomUUID(), label: "Plan tomorrow", order: 1, required: true, countsTowardProgress: true, type: "check" },
        { id: crypto.randomUUID(), label: "Write a journal entry", order: 2, required: false, countsTowardProgress: false, type: "journalLink" },
      ],
    },
    {
      id: crypto.randomUUID(), name: "Trading discipline", areaId: "Trading", icon: "↗",
      schedule: { type: "manual" }, completionRule: { type: "allRequired" }, graceMinutes: 60,
      nextAction: "Review the session after trading", sortOrder: 2, createdAt: timestamp, updatedAt: timestamp,
      tasks: [
        { id: crypto.randomUUID(), label: "Follow the trading plan", order: 0, required: true, countsTowardProgress: true, type: "check" },
        { id: crypto.randomUUID(), label: "Complete session review", order: 1, required: true, countsTowardProgress: true, type: "check" },
      ],
    },
  ];
}

export function createDefaultState(now = new Date()): AppState {
  return {
    schemaVersion: 4,
    routines: defaultRoutines(now),
    checkIns: [],
    journalEntries: [],
    attachments: [],
    settings: { ...DEFAULT_SETTINGS },
    legacyDailySnapshots: [],
    badges: [],
    inAppNotifications: [],
    reportSnapshots: [],
    standaloneTasks: [],
  };
}
