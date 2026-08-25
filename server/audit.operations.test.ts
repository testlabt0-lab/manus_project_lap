import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listAuditEventsForManager: vi.fn(), exportAuditEventsCsvForManager: vi.fn(), exportManagerNotificationResponseCsv: vi.fn(), exportManagerNotificationResponseTrendCsv: vi.fn(), listOperationalVisits: vi.fn(), listManagerNotifications: vi.fn(), getManagerNotificationResponseReport: vi.fn(), getManagerNotificationResponseComparison: vi.fn(), getManagerNotificationResponsePreference: vi.fn(), getManagerNotificationResponseThresholdAlert: vi.fn(), getManagerNotificationResponseTrend: vi.fn(), setManagerNotificationResponsePreference: vi.fn(), acknowledgeManagerNotification: vi.fn(), acknowledgeAllManagerNotifications: vi.fn() }));

vi.mock("./db", () => ({
  acknowledgeAllManagerNotifications: mocks.acknowledgeAllManagerNotifications, acknowledgeManagerNotification: mocks.acknowledgeManagerNotification, assignVisit: vi.fn(), createVisitForPatient: vi.fn(), ensureDemoClinicianForOperationalClinic: vi.fn(), exportAuditEventsCsvForManager: mocks.exportAuditEventsCsvForManager, exportManagerNotificationResponseCsv: mocks.exportManagerNotificationResponseCsv, exportManagerNotificationResponseTrendCsv: mocks.exportManagerNotificationResponseTrendCsv, finalizeReport: vi.fn(), getInvoiceForPatient: vi.fn(), getManagerNotificationResponseComparison: mocks.getManagerNotificationResponseComparison, getManagerNotificationResponsePreference: mocks.getManagerNotificationResponsePreference, getManagerNotificationResponseReport: mocks.getManagerNotificationResponseReport, getManagerNotificationResponseThresholdAlert: mocks.getManagerNotificationResponseThresholdAlert, getManagerNotificationResponseTrend: mocks.getManagerNotificationResponseTrend, getReportForPatient: vi.fn(), getVisitById: vi.fn(), getVisitForPatient: vi.fn(), listActiveMembershipsForUser: vi.fn(), listAssignedVisitsForUser: vi.fn(), listAuditEventsForManager: mocks.listAuditEventsForManager, listManagedStaffMemberships: vi.fn(), listManagerNotifications: mocks.listManagerNotifications, listOperationalVisits: mocks.listOperationalVisits, listStaffForOperationalClinics: vi.fn(), listVisitsForPatient: vi.fn(), recordDemoPayment: vi.fn(), setManagedStaffMembershipStatus: vi.fn(), setManagerNotificationResponsePreference: mocks.setManagerNotificationResponsePreference, transitionVisit: vi.fn(),
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

  it("accepts the notification acknowledgement event type in a manager-scoped audit filter", async () => {
    mocks.listAuditEventsForManager.mockResolvedValue([]);
    const caller = appRouter.createCaller(context("admin"));
    const filter = { eventType: "NOTIFICATION_ACKNOWLEDGED" as const };
    await expect(caller.audit.listOperations(filter)).resolves.toEqual([]);
    expect(mocks.listAuditEventsForManager).toHaveBeenCalledWith(71, filter);
  });

  it("passes a bounded text query to the manager-scoped audit query", async () => {
    mocks.listAuditEventsForManager.mockResolvedValue([]);
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.audit.listOperations({ query: "V-1024" })).resolves.toEqual([]);
    expect(mocks.listAuditEventsForManager).toHaveBeenCalledWith(71, { query: "V-1024" });
  });

  it("rejects an audit query shorter than two characters", async () => {
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.audit.listOperations({ query: "أ" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("exports the manager-scoped audit rows as CSV using the active filters", async () => {
    const exportResult = { filename: "medicare-audit-2026-08-24.csv", content: "\ufeff\"التاريخ UTC\"" };
    mocks.exportAuditEventsCsvForManager.mockResolvedValue(exportResult);
    const caller = appRouter.createCaller(context("admin"));
    const filter = { eventType: "VISIT_STATE_CHANGED" as const, query: "V-1024" };
    await expect(caller.audit.exportCsv(filter)).resolves.toEqual(exportResult);
    expect(mocks.exportAuditEventsCsvForManager).toHaveBeenCalledWith(71, filter);
  });

  it("rejects CSV export for a non-administrator", async () => {
    const caller = appRouter.createCaller(context("user"));
    await expect(caller.audit.exportCsv()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns overdue operational alerts using only the administrator's scoped visits", async () => {
    mocks.listOperationalVisits.mockResolvedValue([{ id: 9, reference: "V-LATE", serviceName: "طب منزلي", scheduledStart: new Date("2026-08-25T10:00:00.000Z"), state: "ASSIGNED" }]);
    const caller = appRouter.createCaller(context("admin"));
    const alerts = await caller.alerts.listOverdue({ graceMinutes: 0 });
    expect(mocks.listOperationalVisits).toHaveBeenCalledWith(71);
    expect(alerts[0]).toMatchObject({ visitId: 9, reference: "V-LATE" });
  });

  it("rejects overdue alert access for a non-administrator", async () => {
    const caller = appRouter.createCaller(context("user"));
    await expect(caller.alerts.listOverdue()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lists manager notifications through the current administrator identity", async () => {
    mocks.listManagerNotifications.mockResolvedValue([{ id: 41, title: "زيارة متأخرة: V-LATE", acknowledgedAt: null }]);
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.notifications.listMine()).resolves.toHaveLength(1);
    expect(mocks.listManagerNotifications).toHaveBeenCalledWith(71);
  });

  it("returns response metrics scoped to the current manager", async () => {
    const report = { total: 5, pending: 2, acknowledged: 3, acknowledgementRate: 60, averageResponseMinutes: 14 };
    mocks.getManagerNotificationResponseReport.mockResolvedValue(report);
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.notifications.responseReport()).resolves.toEqual(report);
    expect(mocks.getManagerNotificationResponseReport).toHaveBeenCalledWith(71, 30);
  });

  it("passes an allowed report period to the manager-scoped response report", async () => {
    mocks.getManagerNotificationResponseReport.mockResolvedValue({ total: 1, pending: 1, acknowledged: 0, acknowledgementRate: 0, averageResponseMinutes: null });
    const caller = appRouter.createCaller(context("admin"));
    await caller.notifications.responseReport({ days: 7 });
    expect(mocks.getManagerNotificationResponseReport).toHaveBeenCalledWith(71, 7);
  });

  it("returns a same-length previous-period comparison for the current manager", async () => {
    const comparison = { current: { total: 5, pending: 2, acknowledged: 3, acknowledgementRate: 60, averageResponseMinutes: 14 }, previous: { total: 4, pending: 3, acknowledged: 1, acknowledgementRate: 25, averageResponseMinutes: 18 }, acknowledgementRateDelta: 35, pendingDelta: -1 };
    mocks.getManagerNotificationResponseComparison.mockResolvedValue(comparison);
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.notifications.responseComparison({ days: 7 })).resolves.toEqual(comparison);
    expect(mocks.getManagerNotificationResponseComparison).toHaveBeenCalledWith(71, 7);
  });

  it("returns a daily response trend for the current manager and selected period", async () => {
    const trend = [{ date: "2026-08-25", total: 2, acknowledged: 1, pending: 1, acknowledgementRate: 50 }];
    mocks.getManagerNotificationResponseTrend.mockResolvedValue(trend);
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.notifications.responseTrend({ days: 7 })).resolves.toEqual(trend);
    expect(mocks.getManagerNotificationResponseTrend).toHaveBeenCalledWith(71, 7);
  });

  it("evaluates a selected acknowledgement threshold for the current manager", async () => {
    const alert = { total: 2, acknowledgementRate: 50, minimumAcknowledgementRate: 70, hasData: true, isBelowThreshold: true, rateGap: -20 };
    mocks.getManagerNotificationResponseThresholdAlert.mockResolvedValue(alert);
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.notifications.responseThresholdAlert({ days: 7, minimumAcknowledgementRate: 70 })).resolves.toEqual(alert);
    expect(mocks.getManagerNotificationResponseThresholdAlert).toHaveBeenCalledWith(71, 7, 70);
  });

  it("reads and saves the acknowledgement preference only for the current manager", async () => {
    mocks.getManagerNotificationResponsePreference.mockResolvedValue({ minimumAcknowledgementRate: 80 });
    mocks.setManagerNotificationResponsePreference.mockResolvedValue({ minimumAcknowledgementRate: 90 });
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.notifications.getResponsePreference()).resolves.toEqual({ minimumAcknowledgementRate: 80 });
    await expect(caller.notifications.setResponsePreference({ minimumAcknowledgementRate: 90 })).resolves.toEqual({ minimumAcknowledgementRate: 90 });
    expect(mocks.getManagerNotificationResponsePreference).toHaveBeenCalledWith(71);
    expect(mocks.setManagerNotificationResponsePreference).toHaveBeenCalledWith(71, 90);
  });

  it("exports response metrics as CSV for the requested report period", async () => {
    mocks.exportManagerNotificationResponseCsv.mockResolvedValue({ filename: "medicare-notification-response-7d.csv", content: "\ufeff\"الفترة بالأيام\"" });
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.notifications.exportResponseCsv({ days: 7 })).resolves.toMatchObject({ filename: "medicare-notification-response-7d.csv" });
    expect(mocks.exportManagerNotificationResponseCsv).toHaveBeenCalledWith(71, 7);
  });

  it("exports daily response trend rows as CSV for the current manager", async () => {
    mocks.exportManagerNotificationResponseTrendCsv.mockResolvedValue({ filename: "medicare-notification-response-trend-7d.csv", content: "\ufeff\"التاريخ UTC\"" });
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.notifications.exportResponseTrendCsv({ days: 7 })).resolves.toMatchObject({ filename: "medicare-notification-response-trend-7d.csv" });
    expect(mocks.exportManagerNotificationResponseTrendCsv).toHaveBeenCalledWith(71, 7);
  });

  it("rejects response metrics for a non-administrator", async () => {
    const caller = appRouter.createCaller(context("user"));
    await expect(caller.notifications.responseReport()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a response comparison for a non-administrator", async () => {
    const caller = appRouter.createCaller(context("user"));
    await expect(caller.notifications.responseComparison({ days: 7 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a response trend for a non-administrator", async () => {
    const caller = appRouter.createCaller(context("user"));
    await expect(caller.notifications.responseTrend({ days: 7 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects daily trend CSV export for a non-administrator", async () => {
    const caller = appRouter.createCaller(context("user"));
    await expect(caller.notifications.exportResponseTrendCsv({ days: 7 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects threshold evaluation for a non-administrator", async () => {
    const caller = appRouter.createCaller(context("user"));
    await expect(caller.notifications.responseThresholdAlert({ days: 7, minimumAcknowledgementRate: 70 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects response preference access for a non-administrator", async () => {
    const caller = appRouter.createCaller(context("user"));
    await expect(caller.notifications.getResponsePreference()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.notifications.setResponsePreference({ minimumAcknowledgementRate: 70 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("acknowledges only a notification accepted by the manager-scoped data layer", async () => {
    mocks.acknowledgeManagerNotification.mockResolvedValue({ id: 41, acknowledgedAt: new Date() });
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.notifications.acknowledge({ notificationId: 41 })).resolves.toMatchObject({ id: 41 });
    expect(mocks.acknowledgeManagerNotification).toHaveBeenCalledWith(71, 41);
  });

  it("acknowledges all pending notifications through the current administrator identity", async () => {
    mocks.acknowledgeAllManagerNotifications.mockResolvedValue({ acknowledgedCount: 3 });
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.notifications.acknowledgeAll()).resolves.toEqual({ acknowledgedCount: 3 });
    expect(mocks.acknowledgeAllManagerNotifications).toHaveBeenCalledWith(71);
  });

  it("rejects bulk notification acknowledgement for a non-administrator", async () => {
    const caller = appRouter.createCaller(context("user"));
    await expect(caller.notifications.acknowledgeAll()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects notification acknowledgement outside the manager scope", async () => {
    mocks.acknowledgeManagerNotification.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.notifications.acknowledge({ notificationId: 999 })).rejects.toMatchObject({ code: "FORBIDDEN" });
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
