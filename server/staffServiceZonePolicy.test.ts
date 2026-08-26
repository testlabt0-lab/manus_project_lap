import { describe, expect, it } from "vitest";
import { isStaffServiceZoneCompatible } from "./staffServiceZonePolicy";

describe("staff service zone policy", () => {
  it("allows the baseline central operational zone without a configured tag", () => {
    expect(isStaffServiceZoneCompatible("CENTRAL", [])).toBe(true);
  });

  it("requires an explicit matching operational zone outside the baseline", () => {
    expect(isStaffServiceZoneCompatible("NORTH", ["NORTH", "EAST"])).toBe(true);
    expect(isStaffServiceZoneCompatible("SOUTH", ["NORTH", "EAST"])).toBe(false);
  });
});
