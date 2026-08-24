import { describe, expect, it } from "vitest";
import { isAllowedVisitTransition } from "./visitPolicy";

describe("visit policy", () => {
  it("permits the defined forward journey but rejects skipped states", () => {
    expect(isAllowedVisitTransition("REQUESTED", "ASSIGNED")).toBe(true);
    expect(isAllowedVisitTransition("ASSIGNED", "CONFIRMED")).toBe(true);
    expect(isAllowedVisitTransition("REQUESTED", "COMPLETED")).toBe(false);
  });

  it("does not permit transition after terminal states", () => {
    expect(isAllowedVisitTransition("COMPLETED", "EN_ROUTE")).toBe(false);
    expect(isAllowedVisitTransition("CANCELLED", "REQUESTED")).toBe(false);
  });
});
