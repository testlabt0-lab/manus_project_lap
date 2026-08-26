import { describe, expect, it } from "vitest";
import { getLocalWeekDays, overlapsLocalDay } from "./staffAvailabilityCalendar";

describe("staff availability calendar", () => {
  it("starts the displayed week on Monday", () => {
    const days = getLocalWeekDays(new Date(2026, 7, 26));
    expect(days).toHaveLength(7);
    expect(days[0].getDay()).toBe(1);
    expect(days[6].getDay()).toBe(0);
  });

  it("includes a window that overlaps the requested local day", () => {
    const day = new Date(2026, 7, 26);
    expect(overlapsLocalDay(new Date(2026, 7, 25, 23), new Date(2026, 7, 26, 1), day)).toBe(true);
    expect(overlapsLocalDay(new Date(2026, 7, 27, 9), new Date(2026, 7, 27, 10), day)).toBe(false);
  });
});
