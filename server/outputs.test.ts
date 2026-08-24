import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getInvoiceForPatient: vi.fn(),
  getReportForPatient: vi.fn(),
}));

vi.mock("./db", () => ({
  assignVisit: vi.fn(),
  createVisitForPatient: vi.fn(),
  getInvoiceForPatient: mocks.getInvoiceForPatient,
  getReportForPatient: mocks.getReportForPatient,
  getVisitById: vi.fn(),
  getVisitForPatient: vi.fn(),
  listActiveMembershipsForUser: vi.fn(),
  listOperationalVisits: vi.fn(),
  listVisitsForPatient: vi.fn(),
  transitionVisit: vi.fn(),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("outputs.reportMine", () => {
  it("reads a finalized report through the authenticated patient identity", async () => {
    mocks.getReportForPatient.mockResolvedValue({ id: 3, visitId: 11, status: "FINALIZED", summary: "ملخص تجريبي آمن" });
    const ctx: TrpcContext = {
      user: { id: 9, openId: "patient", name: "مريض تجريبي", email: "patient@example.test", loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
      req: {} as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);

    await expect(caller.outputs.reportMine({ visitId: 11 })).resolves.toMatchObject({ visitId: 11, status: "FINALIZED" });
    expect(mocks.getReportForPatient).toHaveBeenCalledWith(11, 9);
  });

  it("reads an invoice only through the authenticated patient identity", async () => {
    mocks.getInvoiceForPatient.mockResolvedValue({ id: 8, visitId: 11, invoiceNo: "INV-11", totalHalalas: 27000, status: "DUE" });
    const ctx: TrpcContext = {
      user: { id: 9, openId: "patient", name: "مريض تجريبي", email: "patient@example.test", loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
      req: {} as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);

    await expect(caller.outputs.invoiceMine({ visitId: 11 })).resolves.toMatchObject({ visitId: 11, invoiceNo: "INV-11" });
    expect(mocks.getInvoiceForPatient).toHaveBeenCalledWith(11, 9);
  });
});
