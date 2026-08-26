import { describe, expect, it } from "vitest";
import { findConflictingAssignedVisit } from "./visitAssignmentPolicy";

describe("visit assignment conflict policy", () => {
  const existing = [{ id: 4, reference: "V-4", scheduledStart: new Date("2026-08-27T09:00:00.000Z"), state: "ASSIGNED" }];

  it("finds a conflict when a blocking assignment intersects the 60-minute visit window", () => {
    expect(findConflictingAssignedVisit(existing, 9, new Date("2026-08-27T09:30:00.000Z"))).toMatchObject({ id: 4 });
  });

  it("allows adjacent and non-blocking assignments", () => {
    expect(findConflictingAssignedVisit(existing, 9, new Date("2026-08-27T10:00:00.000Z"))).toBeUndefined();
    expect(findConflictingAssignedVisit([{ ...existing[0], state: "COMPLETED" }], 9, new Date("2026-08-27T09:30:00.000Z"))).toBeUndefined();
  });
});
