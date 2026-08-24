import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listAuditEventsForManager: vi.fn() }));

vi.mock("./db", () => ({
  assignVisit: vi.fn(), createVisitForPatient: vi.fn(), ensureDemoClinicianForOperationalClinic: vi.fn(), finalizeReport: vi.fn(), getInvoiceForPatient: vi.fn(), getReportForPatient: vi.fn(), getVisitById: vi.fn(), getVisitForPatient: vi.fn(), listActiveMembershipsForUser: vi.fn(), listAssignedVisitsForUser: vi.fn(), listAuditEventsForManager: mocks.listAuditEventsForManager, listManagedStaffMemberships: vi.fn(), listOperationalVisits: vi.fn(), listStaffForOperationalClinics: vi.fn(), listVisitsForPatient: vi.fn(), recordDemoPayment: vi.fn(), setManagedStaffMembershipStatus: vi.fn(), transitionVisit: vi.fn(),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(role: "admin" | "user"): TrpcContext {
  return { user: { id: role === "admin" ? 71 : 72, openId: `audit-${role}`, name: "مستخدم تجريبي", email: `${role}@example.test`, loginMethod: "test", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("audit operations", () => {
  it("returns operational audit events through the current administrator identity", async () => {
    mocks.listAuditEventsForManager.mockResolvedValue([{ id: 1, eventType: "VISIT_ASSIGNED", summary: "تم تكليف الزيارة V-1 بعضو فريق." }]);
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.audit.listOperations()).resolves.toHaveLength(1);
    expect(mocks.listAuditEventsForManager).toHaveBeenCalledWith(71, undefined);
  });

  it("passes an event type and date window to the manager-scoped audit query", async () => {
    mocks.listAuditEventsForManager.mockResolvedValue([]);
    const caller = appRouter.createCaller(context("admin"));
    const filter = { eventType: "VISIT_ASSIGNED" as const, from: new Date("2026-08-01T00:00:00.000Z"), to: new Date("2026-08-31T23:59:59.999Z") };
    await expect(caller.audit.listOperations(filter)).resolves.toEqual([]);
    expect(mocks.listAuditEventsForManager).toHaveBeenCalledWith(71, filter);
  });

  it("rejects an inverted audit date window before querying the data layer", async () => {
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.audit.listOperations({ from: new Date("2026-08-31T00:00:00.000Z"), to: new Date("2026-08-01T00:00:00.000Z") })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects audit access for a non-administrator", async () => {
    const caller = appRouter.createCaller(context("user"));
    await expect(caller.audit.listOperations()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
