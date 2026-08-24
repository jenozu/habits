import { calculateRoutineResult, createCheckIn, routineCompletionWithinGrace, updateTaskCompletion } from "../lib/completion";
import { DEFAULT_SETTINGS } from "../types/domain";
import { routine } from "./test-helpers";

describe("routine completion", () => {
  const snapshots = [
    { id: "required", label: "Required", order: 0, required: true, countsTowardProgress: true, type: "check" as const },
    { id: "bonus", label: "Bonus", order: 1, required: false, countsTowardProgress: true, type: "check" as const },
    { id: "unscored", label: "Unscored", order: 2, required: false, countsTowardProgress: false, type: "check" as const },
  ];

  it("separates optional status from progress scoring", () => {
    const result = calculateRoutineResult(snapshots, [{ taskId: "required", completed: true }], { type: "allRequired" });
    expect(result).toEqual({ completionPercent: 50, completed: true });
    const withUnscored = calculateRoutineResult(snapshots, [{ taskId: "required", completed: true }, { taskId: "unscored", completed: true }], { type: "percentage", threshold: 75 });
    expect(withUnscored).toEqual({ completionPercent: 50, completed: false });
  });

  it("supports count, percentage, and duration rules", () => {
    expect(calculateRoutineResult(snapshots, [{ taskId: "required", completed: true }, { taskId: "bonus", completed: true }], { type: "count", requiredCount: 2 }).completed).toBe(true);
    expect(calculateRoutineResult(snapshots, [{ taskId: "required", completed: true }, { taskId: "bonus", completed: true }], { type: "percentage", threshold: 100 }).completed).toBe(true);
    expect(calculateRoutineResult(snapshots, [{ taskId: "required", completed: false, minutes: 30 }], { type: "duration", targetMinutes: 30 }).completed).toBe(true);
  });

  it("attributes historical corrections within their intended date and grace window", () => {
    const definition = routine({ graceMinutes: 60 });
    const initial = createCheckIn(definition, "2026-08-20", true, false);
    const corrected = updateTaskCompletion(initial, "task-1", true, DEFAULT_SETTINGS, new Date("2026-08-22T12:00:00Z"), true);
    expect(corrected.taskCheckIns[0].completedAt).toBe("2026-08-20T16:00:00.000Z");
    expect(routineCompletionWithinGrace(corrected, DEFAULT_SETTINGS)).toBe(true);
  });

  it("rejects completion timestamps after the routine grace deadline", () => {
    const definition = routine({ graceMinutes: 30 });
    const initial = createCheckIn(definition, "2026-08-20", true, false);
    const late = updateTaskCompletion(initial, "task-1", true, DEFAULT_SETTINGS, new Date("2026-08-21T04:31:00Z"));
    expect(late.completed).toBe(true);
    expect(routineCompletionWithinGrace(late, DEFAULT_SETTINGS)).toBe(false);
  });
});
