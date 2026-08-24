type StaffMembership = {
  clinicId: number;
  memberRole: string;
  status: string;
};

export function isEligibleAssigneeMembership(membership: StaffMembership | undefined, clinicId: number): boolean {
  return Boolean(
    membership
      && membership.clinicId === clinicId
      && membership.status === "ACTIVE"
      && (membership.memberRole === "CLINICIAN" || membership.memberRole === "NURSE"),
  );
}
