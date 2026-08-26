import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assignVisit: vi.fn(),
  createVisitForPatient: vi.fn(),
  ensureDemoClinicianForOperationalClinic: vi.fn(),
  getVisitAssignmentAvailability: vi.fn().mockResolvedValue({ visitId: 40, clinicId: 1, visitReference: "V-000040", scheduledStart: new Date("2026-06-01T08:00:00.000Z"), durationMinutes: 60, status: "AVAILABLE" }),
  finalizeReport: vi.fn(),
  getInvoiceForPatient: vi.fn(),
  getReportForPatient: vi.fn(),
  getVisitById: vi.fn(),
  getVisitForPatient: vi.fn(),
  listActiveMembershipsForUser: vi.fn(),
  listAssignedVisitsForUser: vi.fn(),
  listOperationalVisits: vi.fn(),
  listStaffForOperationalClinics: vi.fn(),
  listVisitsForPatient: vi.fn(),
  recordDemoPayment: vi.fn(),
  transitionVisit: vi.fn(),
}));

vi.mock("./db", () => ({ ...mocks }));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(id: number, role: "admin" | "user"): TrpcContext {
  return {
    user: { id, openId: `flow-${id}`, name: "حساب تجريبي آمن", email: `flow-${id}@example.test`, loginMethod: "test", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("operational flow", () => {
  it("completes the protected demonstration flow from assignment to recorded demo payment", async () => {
    const manager = appRouter.createCaller(context(1, "admin"));
    const clinician = appRouter.createCaller(context(2, "user"));
    const patient = appRouter.createCaller(context(3, "user"));
    const staffMember = { userId: 2, displayName: "ممارس تجريبي آمن", clinicId: 1, clinicName: "عيادة الحياة", memberRole: "CLINICIAN" as const };
    const visit = { id: 40, reference: "V-000040", state: "REQUESTED" };
    let state = "REQUESTED";

    mocks.ensureDemoClinicianForOperationalClinic.mockResolvedValue(staffMember);
    mocks.assignVisit.mockImplementation(async () => { state = "ASSIGNED"; return { ...visit, state }; });
    mocks.listAssignedVisitsForUser.mockResolvedValue([{ ...visit, state: "ASSIGNED" }]);
    mocks.getVisitById.mockImplementation(async () => ({ ...visit, state }));
    mocks.transitionVisit.mockImplementation(async ({ nextState }) => { state = nextState; return { ...visit, state }; });
    mocks.finalizeReport.mockResolvedValue({ id: 5, visitId: 40, status: "FINALIZED", summary: "ملخص تجريبي نهائي وآمن للعرض." });
    mocks.getReportForPatient.mockResolvedValue({ id: 5, visitId: 40, status: "FINALIZED", summary: "ملخص تجريبي نهائي وآمن للعرض." });
    mocks.getInvoiceForPatient.mockResolvedValue({ id: 6, visitId: 40, invoiceNo: "INV-000040", totalHalalas: 27000, status: "DUE" });
    mocks.recordDemoPayment.mockResolvedValue({ id: 6, visitId: 40, invoiceNo: "INV-000040", totalHalalas: 27000, status: "PAID" });

    await expect(manager.memberships.ensureDemoClinician()).resolves.toEqual(staffMember);
    await expect(manager.visits.assign({ visitId: 40, assigneeLabel: staffMember.displayName, assigneeUserId: staffMember.userId })).resolves.toMatchObject({ state: "ASSIGNED" });
    await expect(clinician.visits.listAssignedToMe()).resolves.toHaveLength(1);

    for (const nextState of ["CONFIRMED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS", "COMPLETED"] as const) {
      await expect(clinician.visits.transition({ visitId: 40, nextState })).resolves.toMatchObject({ state: nextState });
    }

    await expect(clinician.outputs.finalizeReport({ visitId: 40, summary: "ملخص تجريبي نهائي وآمن للعرض." })).resolves.toMatchObject({ status: "FINALIZED" });
    await expect(patient.outputs.reportMine({ visitId: 40 })).resolves.toMatchObject({ status: "FINALIZED" });
    await expect(patient.outputs.invoiceMine({ visitId: 40 })).resolves.toMatchObject({ status: "DUE" });
    await expect(patient.outputs.recordDemoPayment({ visitId: 40 })).resolves.toMatchObject({ status: "PAID" });

    expect(mocks.assignVisit).toHaveBeenCalledWith({ visitId: 40, assigneeLabel: staffMember.displayName, assigneeUserId: 2, assignedByUserId: 1 });
    expect(mocks.transitionVisit).toHaveBeenLastCalledWith({ visitId: 40, nextState: "COMPLETED", changedByUserId: 2 });
    expect(mocks.finalizeReport).toHaveBeenCalledWith(expect.objectContaining({ visitId: 40, authoredByUserId: 2 }));
    expect(mocks.recordDemoPayment).toHaveBeenCalledWith(40, 3);
  });
});
