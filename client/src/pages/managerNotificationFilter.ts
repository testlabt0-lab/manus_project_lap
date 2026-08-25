export type ManagerNotificationFilter = "ALL" | "PENDING" | "ACKNOWLEDGED";
export type ManagerNotificationSort = "NEWEST" | "OLDEST" | "PENDING_FIRST";

export function filterManagerNotifications<T extends { acknowledgedAt?: Date | null }>(notifications: T[], filter: ManagerNotificationFilter) {
  if (filter === "PENDING") return notifications.filter(notification => !notification.acknowledgedAt);
  if (filter === "ACKNOWLEDGED") return notifications.filter(notification => Boolean(notification.acknowledgedAt));
  return notifications;
}

export function sortManagerNotifications<T extends { acknowledgedAt?: Date | null; createdAt: Date }>(notifications: T[], sort: ManagerNotificationSort) {
  return [...notifications].sort((left, right) => {
    if (sort === "PENDING_FIRST" && Boolean(left.acknowledgedAt) !== Boolean(right.acknowledgedAt)) return left.acknowledgedAt ? 1 : -1;
    const direction = sort === "OLDEST" ? 1 : -1;
    return direction * (left.createdAt.getTime() - right.createdAt.getTime());
  });
}
