import type { ISODate } from "../types/domain";

const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();

function dateFormatter(timeZone: string) {
  let formatter = dateFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dateFormatterCache.set(timeZone, formatter);
  }
  return formatter;
}

export function dateKeyAt(instant: Date | number = new Date(), timeZone = "America/Toronto"): ISODate {
  return dateFormatter(timeZone).format(instant);
}

export function parseDateKey(date: ISODate): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function addDays(date: ISODate, amount: number): ISODate {
  const value = parseDateKey(date);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

export function daysBetween(start: ISODate, end: ISODate): number {
  return Math.round((parseDateKey(end).getTime() - parseDateKey(start).getTime()) / 86_400_000);
}

export function weekday(date: ISODate): number {
  return parseDateKey(date).getUTCDay();
}

export function startOfWeek(date: ISODate, weekStartsOn: number): ISODate {
  const difference = (weekday(date) - weekStartsOn + 7) % 7;
  return addDays(date, -difference);
}

export function weekDates(date: ISODate, weekStartsOn: number): ISODate[] {
  const start = startOfWeek(date, weekStartsOn);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  return Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second) - instant.getTime();
}

export function zonedDateTimeToInstant(
  date: ISODate,
  time: { hour: number; minute?: number; second?: number; millisecond?: number },
  timeZone: string,
): Date {
  const [year, month, day] = date.split("-").map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, time.hour, time.minute ?? 0, time.second ?? 0, time.millisecond ?? 0);
  let result = utcGuess;
  for (let index = 0; index < 3; index += 1) {
    const offset = timeZoneOffsetMs(new Date(result), timeZone);
    const adjusted = utcGuess - offset;
    if (adjusted === result) break;
    result = adjusted;
  }
  return new Date(result);
}

export function endOfZonedDay(date: ISODate, timeZone: string): Date {
  return new Date(zonedDateTimeToInstant(addDays(date, 1), { hour: 0 }, timeZone).getTime() - 1);
}

export function nextZonedMidnight(now: Date, timeZone: string): Date {
  return zonedDateTimeToInstant(addDays(dateKeyAt(now, timeZone), 1), { hour: 0 }, timeZone);
}

export function historicalCompletionInstant(date: ISODate, timeZone: string): string {
  return zonedDateTimeToInstant(date, { hour: 12 }, timeZone).toISOString();
}

export function formatDateLabel(date: ISODate, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone,
  }).format(zonedDateTimeToInstant(date, { hour: 12 }, timeZone));
}
