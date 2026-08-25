import { describe, expect, it } from "vitest";
import { buildNotificationResponseReport } from "./notificationResponsePolicy";

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
