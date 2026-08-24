import { describe, expect, it } from "vitest";
import { isEligibleAssigneeMembership } from "./staffPolicy";

describe("staff assignment policy", () => {
  it("accepts an active clinician or nurse in the same clinic only", () => {
    expect(isEligibleAssigneeMembership({ clinicId: 1, memberRole: "CLINICIAN", status: "ACTIVE" }, 1)).toBe(true);
    expect(isEligibleAssigneeMembership({ clinicId: 1, memberRole: "NURSE", status: "ACTIVE" }, 1)).toBe(true);
  });

  it("rejects inactive staff, staff from another clinic, managers, and missing memberships", () => {
    expect(isEligibleAssigneeMembership({ clinicId: 1, memberRole: "CLINICIAN", status: "INACTIVE" }, 1)).toBe(false);
    expect(isEligibleAssigneeMembership({ clinicId: 2, memberRole: "CLINICIAN", status: "ACTIVE" }, 1)).toBe(false);
    expect(isEligibleAssigneeMembership({ clinicId: 1, memberRole: "MANAGER", status: "ACTIVE" }, 1)).toBe(false);
    expect(isEligibleAssigneeMembership(undefined, 1)).toBe(false);
  });
});
