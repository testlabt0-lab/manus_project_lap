import type { StaffSkillCode } from "../shared/staffSkills";

export function isStaffSkillCompatible(requiredSkill: StaffSkillCode, staffSkills: StaffSkillCode[]) {
  return requiredSkill === "GENERAL_HOME_VISIT" || staffSkills.includes(requiredSkill);
}
