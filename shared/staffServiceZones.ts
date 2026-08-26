export const staffServiceZoneCodes = ["CENTRAL", "NORTH", "SOUTH", "EAST", "WEST"] as const;

export type StaffServiceZoneCode = (typeof staffServiceZoneCodes)[number];

export const staffServiceZoneLabels: Record<StaffServiceZoneCode, string> = {
  CENTRAL: "المنطقة المركزية",
  NORTH: "المنطقة الشمالية",
  SOUTH: "المنطقة الجنوبية",
  EAST: "المنطقة الشرقية",
  WEST: "المنطقة الغربية",
};
