import { describe, expect, it, vi } from "vitest";

const stubs = vi.hoisted(() => ({
  getDb: vi.fn(),
  listPatientNotifications: vi.fn(),
  markPatientNotificationRead: vi.fn(),
}));

vi.mock("./db", () => ({
  assignVisit: vi.fn(), createVisitForPatient: vi.fn(), ensureDemoClinicianForOperationalClinic: vi.fn(), exportAuditEventsCsvForManager: vi.fn(), finalizeReport: vi.fn(), getDb: stubs.getDb, getInvoiceForPatient: vi.fn(), getReportForPatient: vi.fn(), getVisitById: vi.fn(), getVisitForPatient: vi.fn(), listActiveMembershipsForUser: vi.fn(), listAssignedVisitsForUser: vi.fn(), listAuditEventsForManager: vi.fn(), listManagedStaffMemberships: vi.fn(), listOperationalVisits: vi.fn(), listStaffForOperationalClinics: vi.fn(), listVisitsForPatient: vi.fn(), recordDemoPayment: vi.fn(), setManagedStaffMembershipStatus: vi.fn(), transitionVisit: vi.fn(),
}));
vi.mock("./patientNotificationDb", () => ({ listPatientNotifications: stubs.listPatientNotifications, markPatientNotificationRead: stubs.markPatientNotificationRead }));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function contextFor(userId: number): TrpcContext {
  return {
    user: { id: userId, openId: `patient-${userId}`, name: "Patient", email: null, loginMethod: "mobile", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(), mobileScope: "patient" },
    req: {} as TrpcContext["req"], res: {} as TrpcContext["res"],
  };
}

describe("patient notification scope", () => {
  it("lists only notifications queried with the authenticated patient identifier", async () => {
    const database = {};
    stubs.getDb.mockResolvedValue(database);
    stubs.listPatientNotifications.mockResolvedValue([{ id: 6, userId: 22 }]);
    const caller = appRouter.createCaller(contextFor(22));

    await expect(caller.patientNotifications.listMine()).resolves.toEqual([{ id: 6, userId: 22 }]);
    expect(stubs.listPatientNotifications).toHaveBeenCalledWith(database, 22);
  });

  it("marks a notification only under the authenticated patient identifier", async () => {
    const database = {};
    stubs.getDb.mockResolvedValue(database);
    stubs.markPatientNotificationRead.mockResolvedValue(true);
    const caller = appRouter.createCaller(contextFor(22));

    await expect(caller.patientNotifications.markRead({ notificationId: 6 })).resolves.toEqual({ success: true });
    expect(stubs.markPatientNotificationRead).toHaveBeenCalledWith(database, { userId: 22, notificationId: 6 });
  });
});
