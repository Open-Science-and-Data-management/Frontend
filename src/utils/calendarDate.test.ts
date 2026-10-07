import { describe, expect, it } from "vitest";
import {
  dayString,
  fromDayString,
  fromLocalDay,
  toLocalDay,
} from "@/utils/calendarDate";

// These hold in any timezone; the suite is also run under Asia/Bangkok and
// America/New_York, either side of UTC, where the old code drifted.
describe("calendar dates", () => {
  it("round-trips a picked day", () => {
    expect(dayString(fromDayString("2026-03-01"))).toBe("2026-03-01");
  });

  it("stores the day at midnight UTC", () => {
    expect(fromDayString("2026-03-01")?.toISOString()).toBe(
      "2026-03-01T00:00:00.000Z",
    );
  });

  it("reads a date saved the old way, at local midnight, as the day picked", () => {
    const legacy = new Date(2026, 2, 1); // what `new Date("2026-03-01T00:00:00")` stored
    expect(dayString(legacy)).toBe("2026-03-01");
  });

  it("gives local-time code the same calendar day", () => {
    const local = toLocalDay(fromDayString("2026-03-01")!);
    expect([local.getFullYear(), local.getMonth(), local.getDate()]).toEqual([
      2026, 2, 1,
    ]);
    expect(dayString(fromLocalDay(local))).toBe("2026-03-01");
  });

  it("refuses what isn't a day", () => {
    expect(fromDayString("")).toBeUndefined();
    expect(fromDayString("01/03/2026")).toBeUndefined();
    expect(dayString(undefined)).toBe("");
    expect(dayString(new Date("nope"))).toBe("");
  });
});
