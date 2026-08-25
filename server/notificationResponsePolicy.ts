export function buildNotificationResponseReport(notifications: Array<{ createdAt: Date; acknowledgedAt: Date | null }>, days: number, now = Date.now()) {
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  const inPeriod = notifications.filter(notification => new Date(notification.createdAt).getTime() >= cutoff);
  const acknowledged = inPeriod.filter(notification => notification.acknowledgedAt);
  const totalResponseMinutes = acknowledged.reduce((sum, notification) => sum + Math.max(0, Math.round((new Date(notification.acknowledgedAt!).getTime() - new Date(notification.createdAt).getTime()) / 60_000)), 0);
  return { total: inPeriod.length, pending: inPeriod.length - acknowledged.length, acknowledged: acknowledged.length, acknowledgementRate: inPeriod.length === 0 ? 0 : Math.round((acknowledged.length / inPeriod.length) * 100), averageResponseMinutes: acknowledged.length === 0 ? null : Math.round(totalResponseMinutes / acknowledged.length) };
}

export function buildNotificationResponseComparison(notifications: Array<{ createdAt: Date; acknowledgedAt: Date | null }>, days: number, now = Date.now()) {
  const currentStart = now - days * 24 * 60 * 60 * 1000;
  const previousStart = now - days * 2 * 24 * 60 * 60 * 1000;
  const current = buildNotificationResponseReport(notifications, days, now);
  const previous = buildNotificationResponseReport(notifications.filter(item => { const created = new Date(item.createdAt).getTime(); return created >= previousStart && created < currentStart; }), days, currentStart);
  return { current, previous, acknowledgementRateDelta: current.acknowledgementRate - previous.acknowledgementRate, pendingDelta: current.pending - previous.pending };
}
