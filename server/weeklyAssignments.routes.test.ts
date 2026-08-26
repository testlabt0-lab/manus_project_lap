import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listWeeklyAssignmentsForManager: vi.fn() }));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, listWeeklyAssignmentsForManager: mocks.listWeeklyAssignmentsForManager };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(role: "admin" | "user"): TrpcContext {
  return { user: { id: role === "admin" ? 101 : 102, openId: `weekly-${role}`, name: "مدير تجريبي", email: `${role}@example.test`, loginMethod: "test", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("weekly assignment routes", () => {
  it("returns only safe operational assignment fields through the administrator identity", async () => {
    const weekStart = new Date("2026-08-24T00:00:00.000Z");
    mocks.listWeeklyAssignmentsForManager.mockResolvedValue({ clinicId: 2, clinicName: "عيادة تجريبية", weekStart, rows: [{ visitId: 7, reference: "V-7", scheduledStart: new Date("2026-08-25T09:00:00.000Z"), state: "ASSIGNED", assigneeUserId: 19, assigneeLabel: "ممارس تجريبي" }] });
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.assignments.weekly({ clinicId: 2, weekStart })).resolves.toMatchObject({ clinicId: 2, rows: [{ reference: "V-7", assigneeLabel: "ممارس تجريبي" }] });
    expect(mocks.listWeeklyAssignmentsForManager).toHaveBeenCalledWith(101, 2, weekStart);
  });

  it("rejects weekly assignment access for a non-administrator", async () => {
    const caller = appRouter.createCaller(context("user"));
    await expect(caller.assignments.weekly({ clinicId: 2, weekStart: new Date("2026-08-24T00:00:00.000Z") })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
