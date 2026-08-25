import { describe, expect, it } from "vitest";
import { filterManagerNotifications, sortManagerNotifications } from "./managerNotificationFilter";

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

  it("sorts notifications by newest or oldest without mutating the source array", () => {
    const dated = [{ id: 1, acknowledgedAt: null, createdAt: new Date("2026-08-24T12:00:00.000Z") }, { id: 2, acknowledgedAt: null, createdAt: new Date("2026-08-25T12:00:00.000Z") }];
    expect(sortManagerNotifications(dated, "NEWEST").map(notification => notification.id)).toEqual([2, 1]);
    expect(sortManagerNotifications(dated, "OLDEST").map(notification => notification.id)).toEqual([1, 2]);
    expect(dated.map(notification => notification.id)).toEqual([1, 2]);
  });

  it("prioritizes pending notifications and keeps newest-first order within each group", () => {
    const dated = [{ id: 1, acknowledgedAt: new Date("2026-08-25T12:00:00.000Z"), createdAt: new Date("2026-08-25T10:00:00.000Z") }, { id: 2, acknowledgedAt: null, createdAt: new Date("2026-08-25T09:00:00.000Z") }, { id: 3, acknowledgedAt: null, createdAt: new Date("2026-08-25T11:00:00.000Z") }];
    expect(sortManagerNotifications(dated, "PENDING_FIRST").map(notification => notification.id)).toEqual([3, 2, 1]);
  });
});
