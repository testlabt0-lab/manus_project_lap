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

export function buildNotificationResponseTrend(notifications: Array<{ createdAt: Date; acknowledgedAt: Date | null }>, days: number, now = Date.now()) {
  const current = new Date(now);
  const todayStart = Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate());
  const firstDayStart = todayStart - (days - 1) * 24 * 60 * 60 * 1000;
  const buckets = Array.from({ length: days }, (_, index) => {
    const start = firstDayStart + index * 24 * 60 * 60 * 1000;
    const date = new Date(start).toISOString().slice(0, 10);
    return { date, start, total: 0, acknowledged: 0, pending: 0, acknowledgementRate: 0 };
  });

  notifications.forEach(notification => {
    const createdAt = new Date(notification.createdAt).getTime();
    if (createdAt < firstDayStart || createdAt > now) return;
    const index = Math.floor((createdAt - firstDayStart) / (24 * 60 * 60 * 1000));
    const bucket = buckets[index];
    if (!bucket) return;
    bucket.total += 1;
    if (notification.acknowledgedAt) bucket.acknowledged += 1;
  });

  return buckets.map(({ start: _start, ...bucket }) => ({
    ...bucket,
    pending: bucket.total - bucket.acknowledged,
    acknowledgementRate: bucket.total === 0 ? 0 : Math.round((bucket.acknowledged / bucket.total) * 100),
  }));
}
