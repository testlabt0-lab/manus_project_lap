import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getVisitById: vi.fn(),
  transitionVisit: vi.fn(),
}));

vi.mock("./db", () => ({
  assignVisit: vi.fn(),
  createVisitForPatient: vi.fn(),
  ensureDemoClinicianForOperationalClinic: vi.fn(),
  getVisitById: mocks.getVisitById,
  getVisitForPatient: vi.fn(),
  listActiveMembershipsForUser: vi.fn(),
  listAssignedVisitsForUser: vi.fn(),
  listOperationalVisits: vi.fn(),
  listStaffForOperationalClinics: vi.fn(),
  listVisitsForPatient: vi.fn(),
  transitionVisit: mocks.transitionVisit,
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("visits.transition", () => {
  beforeEach(() => {
    mocks.getVisitById.mockReset();
    mocks.transitionVisit.mockReset();
  });

  it("rejects a skipped state transition before writing an event", async () => {
    mocks.getVisitById.mockResolvedValue({ id: 7, state: "REQUESTED" });
    const ctx: TrpcContext = {
      user: {
        id: 1,
        openId: "manager",
        name: "Manager",
        email: "manager@example.test",
        loginMethod: "test",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: {} as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);

    await expect(caller.visits.transition({ visitId: 7, nextState: "COMPLETED" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.transitionVisit).not.toHaveBeenCalled();
  });

  it("rejects a state transition when the current member is not assigned to the visit", async () => {
    mocks.getVisitById.mockResolvedValue({ id: 8, state: "ASSIGNED" });
    mocks.transitionVisit.mockResolvedValue(undefined);
    const ctx: TrpcContext = {
      user: { id: 8, openId: "unassigned-member", name: "عضو غير مكلّف", email: "member@example.test", loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
      req: {} as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);

    await expect(caller.visits.transition({ visitId: 8, nextState: "CONFIRMED" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.transitionVisit).toHaveBeenCalledWith({ visitId: 8, nextState: "CONFIRMED", changedByUserId: 8 });
  });
});
