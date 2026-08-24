import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  finalizeReport: vi.fn(),
  recordDemoPayment: vi.fn(),
}));

vi.mock("./db", () => ({
  assignVisit: vi.fn(),
  createVisitForPatient: vi.fn(),
  ensureDemoClinicianForOperationalClinic: vi.fn(),
  finalizeReport: mocks.finalizeReport,
  getInvoiceForPatient: vi.fn(),
  getReportForPatient: vi.fn(),
  getVisitById: vi.fn(),
  getVisitForPatient: vi.fn(),
  listActiveMembershipsForUser: vi.fn(),
  listAssignedVisitsForUser: vi.fn(),
  listOperationalVisits: vi.fn(),
  listStaffForOperationalClinics: vi.fn(),
  listVisitsForPatient: vi.fn(),
  recordDemoPayment: mocks.recordDemoPayment,
  transitionVisit: vi.fn(),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function userContext(id: number): TrpcContext {
  return { user: { id, openId: `user-${id}`, name: "مستخدم تجريبي", email: `user-${id}@example.test`, loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("output mutations", () => {
  it("passes the clinician identity to report finalization", async () => {
    mocks.finalizeReport.mockResolvedValue({ id: 5, visitId: 22, status: "FINALIZED", summary: "تقرير تجريبي مكتمل وآمن." });
    const caller = appRouter.createCaller(userContext(31));
    await expect(caller.outputs.finalizeReport({ visitId: 22, summary: "تقرير تجريبي مكتمل وآمن." })).resolves.toMatchObject({ visitId: 22 });
    expect(mocks.finalizeReport).toHaveBeenCalledWith({ visitId: 22, summary: "تقرير تجريبي مكتمل وآمن.", authoredByUserId: 31 });
  });

  it("passes the patient identity to the demo payment recorder", async () => {
    mocks.recordDemoPayment.mockResolvedValue({ id: 7, visitId: 22, invoiceNo: "INV-22", status: "PAID" });
    const caller = appRouter.createCaller(userContext(41));
    await expect(caller.outputs.recordDemoPayment({ visitId: 22 })).resolves.toMatchObject({ status: "PAID" });
    expect(mocks.recordDemoPayment).toHaveBeenCalledWith(22, 41);
  });

  it("rejects report finalization when the current user is not the authorized assignee", async () => {
    mocks.finalizeReport.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(userContext(52));
    await expect(caller.outputs.finalizeReport({ visitId: 22, summary: "ملخص تجريبي يتجاوز الحد الأدنى المطلوب." })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a demo payment when the invoice is not eligible for payment", async () => {
    mocks.recordDemoPayment.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(userContext(53));
    await expect(caller.outputs.recordDemoPayment({ visitId: 22 })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
