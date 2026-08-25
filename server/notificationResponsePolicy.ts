export function buildNotificationResponseReport(notifications: Array<{ createdAt: Date; acknowledgedAt: Date | null }>, days: number, now = Date.now()) {
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  const inPeriod = notifications.filter(notification => new Date(notification.createdAt).getTime() >= cutoff);
  const acknowledged = inPeriod.filter(notification => notification.acknowledgedAt);
  const totalResponseMinutes = acknowledged.reduce((sum, notification) => sum + Math.max(0, Math.round((new Date(notification.acknowledgedAt!).getTime() - new Date(notification.createdAt).getTime()) / 60_000)), 0);
  return { total: inPeriod.length, pending: inPeriod.length - acknowledged.length, acknowledged: acknowledged.length, acknowledgementRate: inPeriod.length === 0 ? 0 : Math.round((acknowledged.length / inPeriod.length) * 100), averageResponseMinutes: acknowledged.length === 0 ? null : Math.round(totalResponseMinutes / acknowledged.length) };
}
