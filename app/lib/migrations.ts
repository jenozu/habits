import { calculateRoutineResult, taskSnapshots } from "./completion";
import { dateKeyAt, historicalCompletionInstant } from "./date";
import { DEFAULT_SETTINGS, type AppStateV3, type CompletionRule, type JournalAttachment, type RoutineDefinition, type ScheduleRule } from "../types/domain";

export type V2Step = { id?: string; label?: string; done?: boolean; optional?: boolean };
export type V2Routine = { id?: string; name?: string; area?: string; icon?: string; schedule?: string; nextStep?: string; steps?: V2Step[] };
export type V2Attachment = { id?: string; type?: "image" | "audio"; name?: string };
export type V2Entry = { id?: string; date?: string; title?: string; text?: string; mood?: string; attachments?: V2Attachment[] };
export type V2State = { date?: string; routines?: V2Routine[]; entries?: V2Entry[]; history?: Record<string, number> };

function deterministicUuid(source: string): string {
  let first = 2166136261;
  let second = 2246822507;
  for (let index = 0; index < source.length; index += 1) {
    first = Math.imul(first ^ source.charCodeAt(index), 16777619);
    second = Math.imul(second ^ source.charCodeAt(index), 3266489917);
  }
  const hex = `${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}${((first ^ second) >>> 0).toString(16).padStart(8, "0")}${((first + second) >>> 0).toString(16).padStart(8, "0")}`;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function scheduleFromLabel(label = "Every day"): ScheduleRule {
  const normalized = label.toLowerCase();
  if (normalized.includes("only on") || normalized.includes("manual") || normalized === "custom") return { type: "manual" };
  if (normalized.includes("weekly")) return { type: "timesPerWeek", count: 1 };
  return { type: "daily" };
}

function completionRule(): CompletionRule {
  return { type: "allRequired" };
}

export function migrateV2ToV3(input: V2State | AppStateV3, now = new Date()): AppStateV3 {
  if ((input as AppStateV3).schemaVersion === 3) return input as AppStateV3;
  const v2 = input as V2State;
  const timestamp = now.toISOString();
  const v2Date = v2.date ?? dateKeyAt(now, DEFAULT_SETTINGS.timeZone);
  const attributedTimestamp = historicalCompletionInstant(v2Date, DEFAULT_SETTINGS.timeZone);
  const routines: RoutineDefinition[] = (v2.routines ?? []).map((routine, routineIndex) => {
    const legacyId = routine.id || `routine-${routineIndex}`;
    return {
      id: deterministicUuid(`routine:${legacyId}`),
      name: routine.name || "Untitled routine",
      areaId: routine.area || "Personal",
      icon: routine.icon || "◆",
      schedule: scheduleFromLabel(routine.schedule),
      completionRule: completionRule(),
      graceMinutes: 0,
      nextAction: routine.nextStep || undefined,
      sortOrder: routineIndex,
      createdAt: timestamp,
      updatedAt: timestamp,
      tasks: (routine.steps ?? []).map((step, taskIndex) => ({
        id: deterministicUuid(`routine:${legacyId}:task:${step.id || taskIndex}`),
        label: step.label || "Untitled task",
        order: taskIndex,
        required: !step.optional,
        countsTowardProgress: !step.optional,
        type: legacyId === "evening" && step.id === "daily-journal" ? "journalLink" as const : "check" as const,
      })),
    };
  });
  const checkIns = routines.flatMap((routine, routineIndex) => {
    const source = v2.routines?.[routineIndex];
    const hasActivity = source?.steps?.some((step) => step.done) ?? false;
    const manual = routine.schedule.type === "manual";
    if (manual && !hasActivity) return [];
    const snapshots = taskSnapshots(routine);
    const taskCheckIns = snapshots.map((snapshot, taskIndex) => ({
      taskId: snapshot.id,
      completed: source?.steps?.[taskIndex]?.done === true,
      completedAt: source?.steps?.[taskIndex]?.done ? attributedTimestamp : undefined,
    }));
    const result = calculateRoutineResult(snapshots, taskCheckIns, routine.completionRule);
    return [{
      id: deterministicUuid(`check-in:${routine.id}:${v2Date}`),
      routineId: routine.id,
      routineName: routine.name,
      date: v2Date,
      due: true,
      manuallyActivated: manual,
      taskSnapshots: snapshots,
      taskCheckIns,
      completionRule: routine.completionRule,
      graceMinutes: routine.graceMinutes,
      ...result,
      finalizedAt: result.completed ? attributedTimestamp : undefined,
      updatedAt: timestamp,
    }];
  });
  const attachmentMap = new Map<string, JournalAttachment>();
  const journalEntries = (v2.entries ?? []).map((entry, entryIndex) => {
    const entryId = deterministicUuid(`entry:${entry.id || entryIndex}`);
    const attachmentIds = (entry.attachments ?? []).map((attachment, attachmentIndex) => {
      const id = attachment.id || deterministicUuid(`entry:${entryId}:attachment:${attachmentIndex}`);
      attachmentMap.set(id, {
        id,
        kind: attachment.type === "audio" ? "audio" : "image",
        name: attachment.name || "Legacy attachment",
        mimeType: attachment.type === "audio" ? "audio/webm" : "image/*",
        size: 0,
        createdAt: timestamp,
      });
      return id;
    });
    return {
      id: entryId,
      date: entry.date || v2Date,
      title: entry.title || "",
      text: entry.text || "",
      mood: entry.mood,
      attachmentIds,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  });
  return {
    schemaVersion: 3,
    routines,
    checkIns,
    journalEntries,
    attachments: [...attachmentMap.values()],
    settings: { ...DEFAULT_SETTINGS },
    legacyDailySnapshots: Object.entries(v2.history ?? {}).map(([date, completionPercent]) => ({ date, completionPercent, importedFrom: "v2" as const })),
    badges: [],
    inAppNotifications: [],
    reportSnapshots: [],
  };
}

export function isV2State(value: unknown): value is V2State {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return candidate.schemaVersion === undefined && (candidate.routines === undefined || Array.isArray(candidate.routines)) && (candidate.entries === undefined || Array.isArray(candidate.entries));
}
