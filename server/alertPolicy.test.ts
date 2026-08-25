import { describe, expect, it } from "vitest";
import { getOverdueVisitAlerts } from "./alertPolicy";

describe("getOverdueVisitAlerts", () => {
  const now = new Date("2026-08-25T12:00:00.000Z");

  it("returns only active operational visits outside the configured grace window", () => {
    const alerts = getOverdueVisitAlerts([
      { id: 1, reference: "V-OLD", serviceName: "طب منزلي", scheduledStart: new Date("2026-08-25T10:00:00.000Z"), state: "ASSIGNED" },
      { id: 2, reference: "V-RECENT", serviceName: "طب منزلي", scheduledStart: new Date("2026-08-25T11:45:00.000Z"), state: "EN_ROUTE" },
      { id: 3, reference: "V-DONE", serviceName: "طب منزلي", scheduledStart: new Date("2026-08-25T09:00:00.000Z"), state: "COMPLETED" },
    ], 30, now);
    expect(alerts).toEqual([{ visitId: 1, reference: "V-OLD", serviceName: "طب منزلي", state: "ASSIGNED", scheduledStart: new Date("2026-08-25T10:00:00.000Z"), minutesLate: 120 }]);
  });
});
