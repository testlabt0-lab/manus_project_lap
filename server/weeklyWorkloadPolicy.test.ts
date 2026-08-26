import { describe, expect, it } from "vitest";
import { summarizeWeeklyWorkloads } from "./weeklyWorkloadPolicy";

describe("weekly workload policy", () => {
  it("groups safe assignment counts by team member and prioritizes active workload", () => {
    expect(summarizeWeeklyWorkloads([
      { assigneeUserId: 2, assigneeLabel: "عضو ب", state: "COMPLETED" },
      { assigneeUserId: 1, assigneeLabel: "عضو أ", state: "ASSIGNED" },
      { assigneeUserId: 1, assigneeLabel: "عضو أ", state: "IN_PROGRESS" },
      { assigneeUserId: 2, assigneeLabel: "عضو ب", state: "CANCELLED" },
    ])).toEqual([
      { assigneeUserId: 1, assigneeLabel: "عضو أ", totalAssignments: 2, activeAssignments: 2, completedAssignments: 0, cancelledAssignments: 0 },
      { assigneeUserId: 2, assigneeLabel: "عضو ب", totalAssignments: 2, activeAssignments: 0, completedAssignments: 1, cancelledAssignments: 1 },
    ]);
  });
});
