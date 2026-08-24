import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listManagedStaffMemberships: vi.fn(),
  setManagedStaffMembershipStatus: vi.fn(),
}));

vi.mock("./db", () => ({
  assignVisit: vi.fn(), createVisitForPatient: vi.fn(), ensureDemoClinicianForOperationalClinic: vi.fn(), finalizeReport: vi.fn(), getInvoiceForPatient: vi.fn(), getReportForPatient: vi.fn(), getVisitById: vi.fn(), getVisitForPatient: vi.fn(), listActiveMembershipsForUser: vi.fn(), listAssignedVisitsForUser: vi.fn(), listManagedStaffMemberships: mocks.listManagedStaffMemberships, listOperationalVisits: vi.fn(), listStaffForOperationalClinics: vi.fn(), listVisitsForPatient: vi.fn(), recordDemoPayment: vi.fn(), setManagedStaffMembershipStatus: mocks.setManagedStaffMembershipStatus, transitionVisit: vi.fn(),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(role: "admin" | "user"): TrpcContext {
  return { user: { id: role === "admin" ? 61 : 62, openId: `membership-${role}`, name: "مستخدم تجريبي", email: `${role}@example.test`, loginMethod: "test", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("memberships management", () => {
  it("returns managed staff only through the current administrator identity", async () => {
    mocks.listManagedStaffMemberships.mockResolvedValue([{ membershipId: 8, userId: 9, displayName: "ممارس تجريبي آمن", status: "ACTIVE" }]);
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.memberships.listManagedStaff()).resolves.toHaveLength(1);
    expect(mocks.listManagedStaffMemberships).toHaveBeenCalledWith(61);
  });

  it("passes manager identity and desired status when changing a staff membership", async () => {
    mocks.setManagedStaffMembershipStatus.mockResolvedValue({ id: 8, status: "INACTIVE" });
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.memberships.setStaffStatus({ membershipId: 8, status: "INACTIVE" })).resolves.toMatchObject({ status: "INACTIVE" });
    expect(mocks.setManagedStaffMembershipStatus).toHaveBeenCalledWith({ membershipId: 8, status: "INACTIVE", managerUserId: 61 });
  });

  it("rejects a membership update outside the manager scope", async () => {
    mocks.setManagedStaffMembershipStatus.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.memberships.setStaffStatus({ membershipId: 99, status: "ACTIVE" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
