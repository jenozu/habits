import { act, renderHook } from "@testing-library/react";
import { useCurrentDate } from "../hooks/use-current-date";

describe("current date rollover and resume detection", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("rolls at the next Toronto midnight while the app remains open", async () => {
    vi.setSystemTime(new Date("2026-08-22T03:59:59.900Z"));
    const { result } = renderHook(() => useCurrentDate("America/Toronto"));
    await act(async () => Promise.resolve());
    expect(result.current).toBe("2026-08-21");
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe("2026-08-22");
  });

  it("rechecks the zoned date when the app regains focus", async () => {
    vi.setSystemTime(new Date("2026-08-22T03:00:00Z"));
    const { result } = renderHook(() => useCurrentDate("America/Toronto"));
    await act(async () => Promise.resolve());
    expect(result.current).toBe("2026-08-21");
    vi.setSystemTime(new Date("2026-08-22T05:00:00Z"));
    act(() => window.dispatchEvent(new Event("focus")));
    expect(result.current).toBe("2026-08-22");
  });
});
