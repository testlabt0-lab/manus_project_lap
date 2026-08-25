export type ManagerNotificationFilter = "ALL" | "PENDING" | "ACKNOWLEDGED";

export function filterManagerNotifications<T extends { acknowledgedAt?: Date | null }>(notifications: T[], filter: ManagerNotificationFilter) {
  if (filter === "PENDING") return notifications.filter(notification => !notification.acknowledgedAt);
  if (filter === "ACKNOWLEDGED") return notifications.filter(notification => Boolean(notification.acknowledgedAt));
  return notifications;
}
