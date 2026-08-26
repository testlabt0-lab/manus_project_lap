import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listStaffWeeklyCapacitySettings: vi.fn(), setStaffWeeklyCapacitySetting: vi.fn() }));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, listStaffWeeklyCapacitySettings: mocks.listStaffWeeklyCapacitySettings, setStaffWeeklyCapacitySetting: mocks.setStaffWeeklyCapacitySetting };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(role: "admin" | "user"): TrpcContext {
  return { user: { id: role === "admin" ? 121 : 122, openId: `capacity-${role}`, name: "مدير تجريبي", email: `${role}@example.test`, loginMethod: "test", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("staff weekly capacity routes", () => {
  it("lists and saves a bounded capacity through the administrator identity", async () => {
    mocks.listStaffWeeklyCapacitySettings.mockResolvedValue([{ staffUserId: 9, staffName: "ممارس تجريبي", memberRole: "CLINICIAN", targetActiveAssignments: 5 }]);
    mocks.setStaffWeeklyCapacitySetting.mockResolvedValue({ clinicId: 2, staffUserId: 9, targetActiveAssignments: 8 });
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.staffCapacity.list({ clinicId: 2 })).resolves.toMatchObject([{ staffUserId: 9, targetActiveAssignments: 5 }]);
    await expect(caller.staffCapacity.set({ clinicId: 2, staffUserId: 9, targetActiveAssignments: 8 })).resolves.toMatchObject({ targetActiveAssignments: 8 });
    expect(mocks.listStaffWeeklyCapacitySettings).toHaveBeenCalledWith(121, 2);
    expect(mocks.setStaffWeeklyCapacitySetting).toHaveBeenCalledWith(121, 2, 9, 8);
  });

  it("rejects unprivileged access and capacities outside the allowed range", async () => {
    const userCaller = appRouter.createCaller(context("user"));
    await expect(userCaller.staffCapacity.list({ clinicId: 2 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const adminCaller = appRouter.createCaller(context("admin"));
    await expect(adminCaller.staffCapacity.set({ clinicId: 2, staffUserId: 9, targetActiveAssignments: 21 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
