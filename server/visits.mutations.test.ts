import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assignVisit: vi.fn(),
  createVisitForPatient: vi.fn(),
  ensureDemoClinicianForOperationalClinic: vi.fn(),
  getVisitAssignmentAvailability: vi.fn().mockResolvedValue({ visitId: 14, clinicId: 1, visitReference: "V-000014", scheduledStart: new Date("2026-06-01T08:00:00.000Z"), durationMinutes: 60, status: "AVAILABLE" }),
  listAssignedVisitsForUser: vi.fn(),
  syncFieldAction: vi.fn(),
  getFieldSyncMetricsForManager: vi.fn(),
}));

vi.mock("./db", () => ({
  assignVisit: mocks.assignVisit,
  createVisitForPatient: mocks.createVisitForPatient,
  ensureDemoClinicianForOperationalClinic: mocks.ensureDemoClinicianForOperationalClinic,
  getVisitAssignmentAvailability: mocks.getVisitAssignmentAvailability,
  getVisitById: vi.fn(),
  getVisitForPatient: vi.fn(),
  listActiveMembershipsForUser: vi.fn(),
  listAssignedVisitsForUser: mocks.listAssignedVisitsForUser,
  syncFieldAction: mocks.syncFieldAction,
  getFieldSyncMetricsForManager: mocks.getFieldSyncMetricsForManager,
  listOperationalVisits: vi.fn(),
  listStaffForOperationalClinics: vi.fn(),
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
    mocks.listAssignedVisitsForUser.mockReset();
    mocks.syncFieldAction.mockReset();
    mocks.getFieldSyncMetricsForManager.mockReset();
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

  it("passes the real staff user identifier when assigning a visit", async () => {
    mocks.assignVisit.mockResolvedValue({ id: 14, reference: "V-000014", state: "ASSIGNED" });
    const caller = appRouter.createCaller(context("admin"));

    await caller.visits.assign({ visitId: 14, assigneeLabel: "ممارس تجريبي", assigneeUserId: 9 });
    expect(mocks.assignVisit).toHaveBeenCalledWith({ visitId: 14, assigneeLabel: "ممارس تجريبي", assigneeUserId: 9, assignedByUserId: 2 });
  });

  it("returns assignments scoped to the authenticated team member", async () => {
    const assignedVisits = [{ id: 15, reference: "V-000015", state: "COMPLETED" }];
    mocks.listAssignedVisitsForUser.mockResolvedValue(assignedVisits);
    const caller = appRouter.createCaller(context("user"));

    await expect(caller.visits.listAssignedToMe()).resolves.toEqual(assignedVisits);
    expect(mocks.listAssignedVisitsForUser).toHaveBeenCalledWith(1);
  });

  it("syncs a field action with the authenticated actor and operational identifiers only", async () => {
    const synced = { actionId: "12-ARRIVED-1000", status: "SYNCED", appliedState: "ARRIVED" };
    mocks.syncFieldAction.mockResolvedValue(synced);
    const caller = appRouter.createCaller(context("user"));
    await expect(caller.visits.syncField({ actionId: "12-ARRIVED-1000", visitId: 12, actionType: "ARRIVED" })).resolves.toEqual(synced);
    expect(mocks.syncFieldAction).toHaveBeenCalledWith({ actionId: "12-ARRIVED-1000", visitId: 12, actionType: "ARRIVED", changedByUserId: 1 });
  });

  it("returns aggregated field metrics only to a manager in the requested clinic", async () => {
    const metrics = { clinicId: 1, total: 3, last24Hours: 2, arrived: 1, inProgress: 1, completed: 1, sampledLimit: 500 };
    mocks.getFieldSyncMetricsForManager.mockResolvedValue(metrics);
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.visits.fieldSyncMetrics({ clinicId: 1 })).resolves.toEqual(metrics);
    expect(mocks.getFieldSyncMetricsForManager).toHaveBeenCalledWith(2, 1);
  });

  it("maps invalid field transitions to a conflict without leaking clinical details", async () => {
    mocks.syncFieldAction.mockResolvedValue({ actionId: "12-COMPLETED-1000", status: "REJECTED", reason: "INVALID_STATE" });
    const caller = appRouter.createCaller(context("user"));
    await expect(caller.visits.syncField({ actionId: "12-COMPLETED-1000", visitId: 12, actionType: "COMPLETED" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("returns an empty assigned-task list when membership scope excludes the current user", async () => {
    mocks.listAssignedVisitsForUser.mockResolvedValue([]);
    const caller = appRouter.createCaller(context("user"));

    await expect(caller.visits.listAssignedToMe()).resolves.toEqual([]);
    expect(mocks.listAssignedVisitsForUser).toHaveBeenCalledWith(1);
  });
});
