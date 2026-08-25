import { describe, expect, it } from "vitest";
import { buildNotificationResponseComparison, buildNotificationResponseReport, buildNotificationResponseTrend } from "./notificationResponsePolicy";

describe("notification response period policy", () => {
  it("excludes notifications created before the selected cutoff", () => {
    const now = new Date("2026-08-25T12:00:00.000Z").getTime();
    const report = buildNotificationResponseReport([
      { createdAt: new Date("2026-08-24T12:00:00.000Z"), acknowledgedAt: new Date("2026-08-24T12:30:00.000Z") },
      { createdAt: new Date("2026-08-10T12:00:00.000Z"), acknowledgedAt: null },
    ], 7, now);
    expect(report).toEqual({ total: 1, pending: 0, acknowledged: 1, acknowledgementRate: 100, averageResponseMinutes: 30 });
  });
});

describe("notification response comparison policy", () => {
  it("compares the selected window with its previous matching window", () => {
    const now = new Date("2026-08-25T12:00:00.000Z").getTime();
    const comparison = buildNotificationResponseComparison([
      { createdAt: new Date("2026-08-24T12:00:00.000Z"), acknowledgedAt: new Date("2026-08-24T12:10:00.000Z") },
      { createdAt: new Date("2026-08-15T12:00:00.000Z"), acknowledgedAt: null },
    ], 7, now);
    expect(comparison.current.acknowledgementRate).toBe(100);
    expect(comparison.previous.acknowledgementRate).toBe(0);
    expect(comparison.acknowledgementRateDelta).toBe(100);
  });
});

describe("notification response trend policy", () => {
  it("returns one UTC calendar-day bucket per requested day and excludes older notifications", () => {
    const now = new Date("2026-08-25T12:00:00.000Z").getTime();
    const trend = buildNotificationResponseTrend([
      { createdAt: new Date("2026-08-23T05:00:00.000Z"), acknowledgedAt: new Date("2026-08-23T05:10:00.000Z") },
      { createdAt: new Date("2026-08-24T08:00:00.000Z"), acknowledgedAt: null },
      { createdAt: new Date("2026-08-25T09:00:00.000Z"), acknowledgedAt: new Date("2026-08-25T09:10:00.000Z") },
      { createdAt: new Date("2026-08-22T23:59:00.000Z"), acknowledgedAt: null },
    ], 3, now);
    expect(trend).toEqual([
      { date: "2026-08-23", total: 1, acknowledged: 1, pending: 0, acknowledgementRate: 100 },
      { date: "2026-08-24", total: 1, acknowledged: 0, pending: 1, acknowledgementRate: 0 },
      { date: "2026-08-25", total: 1, acknowledged: 1, pending: 0, acknowledgementRate: 100 },
    ]);
  });
});
