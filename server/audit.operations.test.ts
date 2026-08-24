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
    expect(mocks.listAuditEventsForManager).toHaveBeenCalledWith(71);
  });

  it("rejects audit access for a non-administrator", async () => {
    const caller = appRouter.createCaller(context("user"));
    await expect(caller.audit.listOperations()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
