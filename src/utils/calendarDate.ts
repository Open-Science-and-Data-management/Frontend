/**
 * Calendar dates — a day, with no time of day — in one convention.
 *
 * Stored as a `Date` at midnight UTC, the way `new Date("2026-03-01")` already
 * parses. Read back with UTC getters, never local ones: a UTC-midnight date
 * read in local time is the previous day anywhere west of Greenwich, and a
 * local-midnight date read in UTC is the previous day anywhere east of it
 * (Thailand included). Every date input, display and export goes through here.
 */

const isMidnightUtc = (d: Date) =>
  d.getUTCHours() === 0 &&
  d.getUTCMinutes() === 0 &&
  d.getUTCSeconds() === 0 &&
  d.getUTCMilliseconds() === 0;

const isMidnightLocal = (d: Date) =>
  d.getHours() === 0 &&
  d.getMinutes() === 0 &&
  d.getSeconds() === 0 &&
  d.getMilliseconds() === 0;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * "YYYY-MM-DD" for a stored date. Dates saved before this convention, at
 * *local* midnight, are recognised and read in local time, so they keep the
 * day the person actually picked rather than slipping one back.
 */
export const dayString = (d?: Date | null): string => {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  if (!isMidnightUtc(d) && isMidnightLocal(d))
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return d.toISOString().slice(0, 10);
};

/** The stored form of a "YYYY-MM-DD" value, e.g. from `<input type="date">`. */
export const fromDayString = (value?: string | null): Date | undefined => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

/**
 * The same calendar day at local midnight — for local-time day arithmetic and
 * date-fns formatting, which both work in the viewer's timezone.
 */
export const toLocalDay = (d: Date): Date => {
  const [y, m, day] = dayString(d).split("-").map(Number);
  return new Date(y, m - 1, day);
};

/** Back from a local-midnight working value to the stored form. */
export const fromLocalDay = (d: Date): Date =>
  new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
