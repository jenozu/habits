"use client";

import { useCallback, useEffect, useState } from "react";
import { dateKeyAt, nextZonedMidnight } from "../lib/date";

export function useCurrentDate(timeZone: string) {
  const [date, setDate] = useState(() => dateKeyAt(new Date(), timeZone));
  const refresh = useCallback(() => setDate(dateKeyAt(new Date(), timeZone)), [timeZone]);

  useEffect(() => {
    queueMicrotask(refresh);
    let timer = 0;
    const schedule = () => {
      window.clearTimeout(timer);
      const delay = Math.max(50, nextZonedMidnight(new Date(), timeZone).getTime() - Date.now() + 50);
      timer = window.setTimeout(() => {
        refresh();
        schedule();
      }, Math.min(delay, 2_147_000_000));
    };
    const onVisibility = () => { if (document.visibilityState === "visible") { refresh(); schedule(); } };
    const onFocus = () => { refresh(); schedule(); };
    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh, timeZone]);

  return date;
}
