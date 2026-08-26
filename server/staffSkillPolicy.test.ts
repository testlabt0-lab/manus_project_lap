import { describe, expect, it } from "vitest";
import { isStaffSkillCompatible } from "./staffSkillPolicy";

describe("staff skill policy", () => {
  it("allows the general operational visit requirement without a configured tag", () => {
    expect(isStaffSkillCompatible("GENERAL_HOME_VISIT", [])).toBe(true);
  });

  it("requires an explicit matching tag for a specialized operational requirement", () => {
    expect(isStaffSkillCompatible("MOBILITY_ASSISTANCE", ["MOBILITY_ASSISTANCE"])).toBe(true);
    expect(isStaffSkillCompatible("SAMPLE_COLLECTION", ["MOBILITY_ASSISTANCE"])).toBe(false);
  });
});
