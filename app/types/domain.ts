export type ISODate = string;
export type ISODateTime = string;

export type ScheduleRule =
  | { type: "daily" }
  | { type: "weekdays"; days: number[] }
  | { type: "timesPerWeek"; count: number }
  | { type: "interval"; every: number; unit: "day" | "week"; anchorDate: ISODate }
  | { type: "specificDates"; dates: ISODate[] }
  | { type: "manual" };

export type CompletionRule =
  | { type: "allRequired" }
  | { type: "percentage"; threshold: number }
  | { type: "count"; requiredCount: number }
  | { type: "duration"; targetMinutes: number };

export type TaskType = "check" | "stopwatch" | "countdown" | "manualMinutes" | "journalLink";

export type TaskDefinition = {
  id: string;
  label: string;
  order: number;
  required: boolean;
  countsTowardProgress: boolean;
  type: TaskType;
  targetMinutes?: number;
  archivedAt?: ISODateTime;
};

export type RoutineDefinition = {
  id: string;
  name: string;
  areaId: string;
  icon: string;
  color?: string;
  description?: string;
  nextAction?: string;
  schedule: ScheduleRule;
  completionRule: CompletionRule;
  reminderWindow?: { start: string; end: string };
  graceMinutes: number;
  tasks: TaskDefinition[];
  sortOrder: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  archivedAt?: ISODateTime;
};

export type TaskCheckIn = {
  taskId: string;
  completed: boolean;
  minutes?: number;
  completedAt?: ISODateTime;
  note?: string;
};

export type TaskSnapshot = Pick<
  TaskDefinition,
  "id" | "label" | "order" | "required" | "countsTowardProgress" | "type" | "targetMinutes"
>;

export type RoutineCheckIn = {
  id: string;
  routineId: string;
  routineName: string;
  date: ISODate;
  due: boolean;
  manuallyActivated: boolean;
  taskSnapshots: TaskSnapshot[];
  taskCheckIns: TaskCheckIn[];
  completionRule: CompletionRule;
  graceMinutes: number;
  completionPercent: number;
  completed: boolean;
  finalizedAt?: ISODateTime;
  updatedAt: ISODateTime;
};

export type JournalAttachment = {
  id: string;
  kind: "image" | "audio";
  name: string;
  mimeType: string;
  size: number;
  durationSeconds?: number;
  width?: number;
  height?: number;
  createdAt: ISODateTime;
};

export type JournalEntry = {
  id: string;
  date: ISODate;
  title: string;
  text: string;
  mood?: string;
  attachmentIds: string[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type SuccessfulDayRule =
  | { type: "allDueRoutines" }
  | { type: "percentage"; threshold: number }
  | { type: "selectedRoutines"; routineIds: string[] };

export type AppSettings = {
  timeZone: string;
  weekStartsOn: number;
  successfulDayRule: SuccessfulDayRule;
  theme: "system" | "light" | "dark";
  dailyJournalReminderEnabled: boolean;
};

export type LegacyDailySnapshot = {
  date: ISODate;
  completionPercent: number;
  importedFrom: "v2";
};

export type StandaloneTaskPriority = "low" | "normal" | "high";

export type StandaloneTask = {
  id: string;
  title: string;
  notes?: string;
  dueDate?: ISODate;
  dueTime?: string;
  priority: StandaloneTaskPriority;
  completedAt?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  deletedAt?: ISODateTime;
};

export type AppStateV3 = {
  schemaVersion: 3;
  routines: RoutineDefinition[];
  checkIns: RoutineCheckIn[];
  journalEntries: JournalEntry[];
  attachments: JournalAttachment[];
  settings: AppSettings;
  legacyDailySnapshots: LegacyDailySnapshot[];
  badges: { badgeId: string; unlockedAt: ISODateTime }[];
  inAppNotifications: { id: string; createdAt: ISODateTime; message: string; readAt?: ISODateTime }[];
  reportSnapshots: { id: string; weekStart: ISODate; createdAt: ISODateTime }[];
};

export type AppStateV4 = Omit<AppStateV3, "schemaVersion"> & {
  schemaVersion: 4;
  standaloneTasks: StandaloneTask[];
};

export type AppStateV5 = Omit<AppStateV4, "schemaVersion"> & {
  schemaVersion: 5;
};

export type AppState = AppStateV5;

export const DEFAULT_SETTINGS: AppSettings = {
  timeZone: "America/Toronto",
  weekStartsOn: 0,
  successfulDayRule: { type: "allDueRoutines" },
  theme: "light",
  dailyJournalReminderEnabled: true,
};
