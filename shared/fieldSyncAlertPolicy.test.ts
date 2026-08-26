import { describe, expect, it } from "vitest";
import { fieldSyncFailureAlertThreshold, shouldAlertOnFieldSyncFailures } from "./fieldSyncAlertPolicy";

describe("field sync alert policy", () => {
  it("alerts at the configured threshold", () => {
    expect(shouldAlertOnFieldSyncFailures(fieldSyncFailureAlertThreshold)).toBe(true);
    expect(shouldAlertOnFieldSyncFailures(fieldSyncFailureAlertThreshold - 1)).toBe(false);
  });

  it("ignores non-finite failure counts", () => {
    expect(shouldAlertOnFieldSyncFailures(Number.NaN)).toBe(false);
    expect(shouldAlertOnFieldSyncFailures(Number.POSITIVE_INFINITY)).toBe(false);
  });
});
