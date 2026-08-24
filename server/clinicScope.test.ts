import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assignVisit: vi.fn(),
  ensureDemoClinicianForOperationalClinic: vi.fn(),
  listOperationalVisits: vi.fn(),
}));

vi.mock("./db", () => ({
  assignVisit: mocks.assignVisit,
  createVisitForPatient: vi.fn(),
  ensureDemoClinicianForOperationalClinic: mocks.ensureDemoClinicianForOperationalClinic,
  getInvoiceForPatient: vi.fn(),
  getReportForPatient: vi.fn(),
  getVisitById: vi.fn(),
  getVisitForPatient: vi.fn(),
  listActiveMembershipsForUser: vi.fn(),
  listAssignedVisitsForUser: vi.fn(),
  listOperationalVisits: mocks.listOperationalVisits,
  listStaffForOperationalClinics: vi.fn(),
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

  it("rejects an inactive clinician supplied to the assignment router", async () => {
    mocks.assignVisit.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(managerContext());
    await expect(caller.visits.assign({ visitId: 78, assigneeLabel: "ممارس غير نشط", assigneeUserId: 88 })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.assignVisit).toHaveBeenCalledWith({ visitId: 78, assigneeLabel: "ممارس غير نشط", assigneeUserId: 88, assignedByUserId: 44 });
  });

  it("rejects staff from another clinic supplied to the assignment router", async () => {
    mocks.assignVisit.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(managerContext());
    await expect(caller.visits.assign({ visitId: 79, assigneeLabel: "ممارس خارج العيادة", assigneeUserId: 89 })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.assignVisit).toHaveBeenCalledWith({ visitId: 79, assigneeLabel: "ممارس خارج العيادة", assigneeUserId: 89, assignedByUserId: 44 });
  });

  it("creates a safe demo clinician only through the authenticated manager identity", async () => {
    mocks.ensureDemoClinicianForOperationalClinic.mockResolvedValue({ userId: 81, displayName: "ممارس تجريبي آمن", clinicId: 1, clinicName: "عيادة الحياة", memberRole: "CLINICIAN" });
    const caller = appRouter.createCaller(managerContext());
    await expect(caller.memberships.ensureDemoClinician()).resolves.toMatchObject({ userId: 81, memberRole: "CLINICIAN" });
    expect(mocks.ensureDemoClinicianForOperationalClinic).toHaveBeenCalledWith(44);
  });
});
