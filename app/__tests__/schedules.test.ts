import { createCheckIn } from "../lib/completion";
import { isRoutineAvailable, isRoutineDue } from "../lib/schedules";
import { DEFAULT_SETTINGS } from "../types/domain";
import { completedCheckIn, routine } from "./test-helpers";

const settings = { ...DEFAULT_SETTINGS, weekStartsOn: 1 };

describe("routine schedules", () => {
  it("supports daily and selected weekdays", () => {
    expect(isRoutineDue(routine({ schedule: { type: "daily" } }), "2026-08-18", [], settings)).toBe(true);
    const monday = routine({ schedule: { type: "weekdays", days: [1] } });
    expect(isRoutineDue(monday, "2026-08-17", [], settings)).toBe(true);
    expect(isRoutineDue(monday, "2026-08-18", [], settings)).toBe(false);
  });

  it("makes times-per-week routines available without inventing daily misses", () => {
    const weekly = routine({ schedule: { type: "timesPerWeek", count: 2 } });
    expect(isRoutineDue(weekly, "2026-08-17", [], settings)).toBe(false);
    expect(isRoutineAvailable(weekly, "2026-08-17", [], settings)).toBe(true);
    const activated = createCheckIn(weekly, "2026-08-17", true, true);
    expect(isRoutineDue(weekly, "2026-08-17", [activated], settings)).toBe(true);
    const done = [completedCheckIn(weekly, "2026-08-17"), completedCheckIn(weekly, "2026-08-18")];
    expect(isRoutineAvailable(weekly, "2026-08-19", done, settings)).toBe(false);
  });

  it("supports day/week intervals and specific dates", () => {
    const interval = routine({ schedule: { type: "interval", every: 2, unit: "day", anchorDate: "2026-08-17" } });
    expect(isRoutineDue(interval, "2026-08-19", [], settings)).toBe(true);
    expect(isRoutineDue(interval, "2026-08-20", [], settings)).toBe(false);
    const biweekly = routine({ schedule: { type: "interval", every: 2, unit: "week", anchorDate: "2026-08-03" } });
    expect(isRoutineDue(biweekly, "2026-08-17", [], settings)).toBe(true);
    const dates = routine({ schedule: { type: "specificDates", dates: ["2026-08-21"] } });
    expect(isRoutineDue(dates, "2026-08-21", [], settings)).toBe(true);
    expect(isRoutineDue(dates, "2026-08-22", [], settings)).toBe(false);
  });

  it("requires explicit activation for manual routines", () => {
    const manual = routine({ schedule: { type: "manual" } });
    expect(isRoutineDue(manual, "2026-08-21", [], settings)).toBe(false);
    expect(isRoutineAvailable(manual, "2026-08-21", [], settings)).toBe(true);
    const activated = createCheckIn(manual, "2026-08-21", true, true);
    expect(isRoutineDue(manual, "2026-08-21", [activated], settings)).toBe(true);
  });
});
