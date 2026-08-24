import { dateKeyAt, nextZonedMidnight, startOfWeek, weekDates, zonedDateTimeToInstant } from "../lib/date";

describe("configured calendar boundaries", () => {
  it("creates Toronto date keys around the spring DST boundary", () => {
    expect(dateKeyAt(new Date("2026-03-08T04:59:00Z"), "America/Toronto")).toBe("2026-03-07");
    expect(dateKeyAt(new Date("2026-03-08T05:00:00Z"), "America/Toronto")).toBe("2026-03-08");
    expect(nextZonedMidnight(new Date("2026-03-08T16:00:00Z"), "America/Toronto").toISOString()).toBe("2026-03-09T04:00:00.000Z");
  });

  it("uses the later offset after the fall DST transition", () => {
    expect(nextZonedMidnight(new Date("2026-11-01T18:00:00Z"), "America/Toronto").toISOString()).toBe("2026-11-02T05:00:00.000Z");
    expect(zonedDateTimeToInstant("2026-11-02", { hour: 0 }, "America/Toronto").toISOString()).toBe("2026-11-02T05:00:00.000Z");
  });

  it("honors configurable week starts", () => {
    expect(startOfWeek("2026-08-21", 0)).toBe("2026-08-16");
    expect(startOfWeek("2026-08-21", 1)).toBe("2026-08-17");
    expect(weekDates("2026-08-21", 1)).toEqual(["2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20", "2026-08-21", "2026-08-22", "2026-08-23"]);
  });
});
