import { describe, expect, it } from "vitest";
import { filterManagerNotifications } from "./managerNotificationFilter";

describe("manager notification filter", () => {
  const notifications = [{ id: 1, acknowledgedAt: null }, { id: 2, acknowledgedAt: new Date("2026-08-25T12:00:00.000Z") }];

  it("keeps all notifications for the all filter", () => {
    expect(filterManagerNotifications(notifications, "ALL")).toHaveLength(2);
  });

  it("keeps only pending notifications for the pending filter", () => {
    expect(filterManagerNotifications(notifications, "PENDING")).toEqual([{ id: 1, acknowledgedAt: null }]);
  });

  it("keeps only acknowledged notifications for the acknowledged filter", () => {
    expect(filterManagerNotifications(notifications, "ACKNOWLEDGED")).toEqual([{ id: 2, acknowledgedAt: new Date("2026-08-25T12:00:00.000Z") }]);
  });
});
