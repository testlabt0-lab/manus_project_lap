export const staffSkillCodes = ["GENERAL_HOME_VISIT", "MOBILITY_ASSISTANCE", "MEDICATION_SUPPORT", "SAMPLE_COLLECTION"] as const;

export type StaffSkillCode = (typeof staffSkillCodes)[number];

export const staffSkillLabels: Record<StaffSkillCode, string> = {
  GENERAL_HOME_VISIT: "زيارة منزلية عامة",
  MOBILITY_ASSISTANCE: "مساندة الحركة",
  MEDICATION_SUPPORT: "دعم الأدوية",
  SAMPLE_COLLECTION: "جمع العيّنات",
};
