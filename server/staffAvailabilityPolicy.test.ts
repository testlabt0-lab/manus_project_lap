import { describe, expect, it } from "vitest";
import { hasAvailabilityOverlap } from "./staffAvailabilityPolicy";

describe("staff availability policy", () => {
  const windows = [{ id: 4, startAt: new Date("2026-08-26T08:00:00.000Z"), endAt: new Date("2026-08-26T12:00:00.000Z"), cancelledAt: null }];

  it("detects overlapping active availability windows", () => {
    expect(hasAvailabilityOverlap(windows, new Date("2026-08-26T10:00:00.000Z"), new Date("2026-08-26T13:00:00.000Z"))).toBe(true);
  });

  it("allows adjacent, cancelled, and self-editing windows", () => {
    expect(hasAvailabilityOverlap(windows, new Date("2026-08-26T12:00:00.000Z"), new Date("2026-08-26T14:00:00.000Z"))).toBe(false);
    expect(hasAvailabilityOverlap([{ ...windows[0], cancelledAt: new Date() }], new Date("2026-08-26T10:00:00.000Z"), new Date("2026-08-26T11:00:00.000Z"))).toBe(false);
    expect(hasAvailabilityOverlap(windows, new Date("2026-08-26T10:00:00.000Z"), new Date("2026-08-26T11:00:00.000Z"), 4)).toBe(false);
  });
});
