import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assignVisit: vi.fn(),
  createVisitForPatient: vi.fn(),
}));

vi.mock("./db", () => ({
  assignVisit: mocks.assignVisit,
  createVisitForPatient: mocks.createVisitForPatient,
  getVisitById: vi.fn(),
  getVisitForPatient: vi.fn(),
  listOperationalVisits: vi.fn(),
  listVisitsForPatient: vi.fn(),
  transitionVisit: vi.fn(),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(role: "user" | "admin"): TrpcContext {
  return {
    user: {
      id: role === "admin" ? 2 : 1,
      openId: `test-${role}`,
      name: "مستخدم تجريبي",
      email: `${role}@example.test`,
      loginMethod: "test",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("visits mutations", () => {
  beforeEach(() => {
    mocks.assignVisit.mockReset();
    mocks.createVisitForPatient.mockReset();
  });

  it("creates a booking for the authenticated patient only", async () => {
    const savedVisit = { id: 12, reference: "V-000012", state: "REQUESTED" };
    mocks.createVisitForPatient.mockResolvedValue(savedVisit);
    const caller = appRouter.createCaller(context("user"));

    await expect(caller.visits.create({ clinicName: "عيادة الحياة", serviceName: "طب عام", districtLabel: "حي تجريبي", scheduledStart: new Date("2026-06-01T08:00:00Z") })).resolves.toEqual(savedVisit);
    expect(mocks.createVisitForPatient).toHaveBeenCalledWith(expect.objectContaining({ patientId: 1, clinicName: "عيادة الحياة", serviceName: "طب عام" }));
  });

  it("allows an administrator to assign a requested visit", async () => {
    const assignedVisit = { id: 12, reference: "V-000012", state: "ASSIGNED" };
    mocks.assignVisit.mockResolvedValue(assignedVisit);
    const caller = appRouter.createCaller(context("admin"));

    await expect(caller.visits.assign({ visitId: 12, assigneeLabel: "فريق ميداني تجريبي" })).resolves.toEqual(assignedVisit);
    expect(mocks.assignVisit).toHaveBeenCalledWith({ visitId: 12, assigneeLabel: "فريق ميداني تجريبي", assignedByUserId: 2 });
  });
});
