import type { StaffServiceZoneCode } from "../shared/staffServiceZones";

export function isStaffServiceZoneCompatible(requiredZone: StaffServiceZoneCode, staffZones: StaffServiceZoneCode[]) {
  return requiredZone === "CENTRAL" || staffZones.includes(requiredZone);
}
