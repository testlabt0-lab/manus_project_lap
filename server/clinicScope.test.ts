import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assignVisit: vi.fn(),
  listOperationalVisits: vi.fn(),
}));

vi.mock("./db", () => ({
  assignVisit: mocks.assignVisit,
  createVisitForPatient: vi.fn(),
  getInvoiceForPatient: vi.fn(),
  getReportForPatient: vi.fn(),
  getVisitById: vi.fn(),
  getVisitForPatient: vi.fn(),
  listActiveMembershipsForUser: vi.fn(),
  listOperationalVisits: mocks.listOperationalVisits,
  listVisitsForPatient: vi.fn(),
  transitionVisit: vi.fn(),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function managerContext(): TrpcContext {
  return { user: { id: 44, openId: "clinic-manager", name: "مدير", email: "manager@example.test", loginMethod: "test", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("clinic scope", () => {
  it("passes the current manager identity when reading the operational scope", async () => {
    mocks.listOperationalVisits.mockResolvedValue([]);
    const caller = appRouter.createCaller(managerContext());
    await expect(caller.visits.listOperations()).resolves.toEqual([]);
    expect(mocks.listOperationalVisits).toHaveBeenCalledWith(44);
  });

  it("rejects assignment when the data layer finds no matching active clinic membership", async () => {
    mocks.assignVisit.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(managerContext());
    await expect(caller.visits.assign({ visitId: 77, assigneeLabel: "فريق خارج النطاق" })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
