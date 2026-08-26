export type WeeklyAssignmentForWorkload = {
  assigneeUserId: number;
  assigneeLabel: string;
  state: string;
};

const activeStates = new Set(["ASSIGNED", "CONFIRMED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS"]);

export function summarizeWeeklyWorkloads(assignments: WeeklyAssignmentForWorkload[]) {
  const grouped = new Map<number, { assigneeUserId: number; assigneeLabel: string; totalAssignments: number; activeAssignments: number; completedAssignments: number; cancelledAssignments: number }>();
  for (const assignment of assignments) {
    const current = grouped.get(assignment.assigneeUserId) ?? { assigneeUserId: assignment.assigneeUserId, assigneeLabel: assignment.assigneeLabel, totalAssignments: 0, activeAssignments: 0, completedAssignments: 0, cancelledAssignments: 0 };
    current.totalAssignments += 1;
    if (activeStates.has(assignment.state)) current.activeAssignments += 1;
    if (assignment.state === "COMPLETED") current.completedAssignments += 1;
    if (assignment.state === "CANCELLED") current.cancelledAssignments += 1;
    grouped.set(assignment.assigneeUserId, current);
  }
  return Array.from(grouped.values()).sort((left, right) => right.activeAssignments - left.activeAssignments || right.totalAssignments - left.totalAssignments || left.assigneeLabel.localeCompare(right.assigneeLabel, "ar"));
}
