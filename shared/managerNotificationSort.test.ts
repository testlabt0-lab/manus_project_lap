import { describe, expect, it } from "vitest";
import { sortManagerNotifications } from "../client/src/pages/managerNotificationFilter";

describe("manager notification sort", () => {
  const notifications = [{ id: 1, acknowledgedAt: new Date("2026-08-25T12:00:00.000Z"), createdAt: new Date("2026-08-25T10:00:00.000Z") }, { id: 2, acknowledgedAt: null, createdAt: new Date("2026-08-25T09:00:00.000Z") }, { id: 3, acknowledgedAt: null, createdAt: new Date("2026-08-25T11:00:00.000Z") }];

  it("orders newest, oldest, and pending-first notifications predictably", () => {
    expect(sortManagerNotifications(notifications, "NEWEST").map(notification => notification.id)).toEqual([3, 1, 2]);
    expect(sortManagerNotifications(notifications, "OLDEST").map(notification => notification.id)).toEqual([2, 1, 3]);
    expect(sortManagerNotifications(notifications, "PENDING_FIRST").map(notification => notification.id)).toEqual([3, 2, 1]);
  });
});
