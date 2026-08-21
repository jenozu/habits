import { createCheckIn, updateTaskCompletion } from "../lib/completion";
import { calculateOverallStreak, dueProgressForDate, evaluateDay } from "../lib/streaks";
import { DEFAULT_SETTINGS } from "../types/domain";
import { completedCheckIn, routine, state } from "./test-helpers";

describe("successful days and overall streaks", () => {
  it("treats days with nothing due as neutral", () => {
    const definition = routine({ schedule: { type: "specificDates", dates: ["2026-08-20"] } });
    const app = state([definition], [completedCheckIn(definition, "2026-08-20")]);
    expect(evaluateDay(app, "2026-08-21", new Date("2026-08-22T12:00:00Z"))).toBe("neutral");
    expect(calculateOverallStreak(app, "2026-08-21", new Date("2026-08-22T12:00:00Z"))).toBe(1);
  });

  it("calculates daily progress from due routines only", () => {
    const daily = routine({ id: "daily" });
    const manual = routine({ id: "manual", schedule: { type: "manual" } });
    const app = state([daily, manual], [completedCheckIn(daily, "2026-08-21")]);
    expect(dueProgressForDate(app, "2026-08-21")).toEqual({ complete: 1, total: 1, percent: 100, neutral: false });
  });

  it("keeps an incomplete day provisional until its grace deadline", () => {
    const definition = routine({ graceMinutes: 60 });
    const app = state([definition]);
    expect(evaluateDay(app, "2026-08-21", new Date("2026-08-22T04:30:00Z"))).toBe("provisional");
    expect(evaluateDay(app, "2026-08-21", new Date("2026-08-22T05:01:00Z"))).toBe("failure");
  });

  it("applies percentage and selected-routine successful-day rules", () => {
    const first = routine({ id: "first" });
    const second = routine({ id: "second", tasks: [{ id: "task-2", label: "Task", order: 0, required: true, countsTowardProgress: true, type: "check" }] });
    const app = state([first, second], [completedCheckIn(first, "2026-08-20")]);
    app.settings.successfulDayRule = { type: "percentage", threshold: 50 };
    expect(evaluateDay(app, "2026-08-20", new Date("2026-08-22T12:00:00Z"))).toBe("success");
    app.settings.successfulDayRule = { type: "selectedRoutines", routineIds: ["second"] };
    expect(evaluateDay(app, "2026-08-20", new Date("2026-08-22T12:00:00Z"))).toBe("failure");
  });

  it("recalculates the streak after a historical edit", () => {
    const definition = routine({ schedule: { type: "specificDates", dates: ["2026-08-20"] } });
    const incomplete = createCheckIn(definition, "2026-08-20", true, false);
    const app = state([definition], [incomplete]);
    const now = new Date("2026-08-22T12:00:00Z");
    expect(calculateOverallStreak(app, "2026-08-21", now)).toBe(0);
    app.checkIns[0] = updateTaskCompletion(incomplete, "task-1", true, { ...DEFAULT_SETTINGS }, now, true);
    expect(calculateOverallStreak(app, "2026-08-21", now)).toBe(1);
  });
});
