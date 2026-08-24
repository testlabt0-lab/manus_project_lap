import { describe, expect, it } from "vitest";
import { canReadPatientVisitOutput, canTransitionVisit, nextVisitState, progressForVisit } from "./medicare";

describe("MediCare visit state machine", () => {
  it("accepts only the prescribed transition from a confirmed visit", () => {
    expect(canTransitionVisit("CONFIRMED", "EN_ROUTE")).toBe(true);
    expect(canTransitionVisit("CONFIRMED", "COMPLETED")).toBe(false);
  });

  it("does not offer a follow-up state for terminal visits", () => {
    expect(nextVisitState("COMPLETED")).toBeNull();
    expect(nextVisitState("CANCELLED")).toBeNull();
  });

  it("reports a monotonic visual progress for the operational journey", () => {
    expect(progressForVisit("REQUESTED")).toBe(0);
    expect(progressForVisit("COMPLETED")).toBe(100);
    expect(progressForVisit("EN_ROUTE")).toBeGreaterThan(progressForVisit("CONFIRMED"));
  });

  it("keeps patient report and invoice outputs locked until completion and permission", () => {
    expect(canReadPatientVisitOutput("EN_ROUTE")).toBe(false);
    expect(canReadPatientVisitOutput("COMPLETED", false)).toBe(false);
    expect(canReadPatientVisitOutput("COMPLETED", true)).toBe(true);
  });
});
