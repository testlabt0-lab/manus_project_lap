export type AvailabilityInterval = { id: number; startAt: Date | string; endAt: Date | string; cancelledAt?: Date | string | null };

export function hasAvailabilityOverlap(windows: AvailabilityInterval[], startAt: Date, endAt: Date, excludeWindowId?: number) {
  return windows.some(window => {
    if (window.cancelledAt || window.id === excludeWindowId) return false;
    return new Date(window.startAt) < endAt && new Date(window.endAt) > startAt;
  });
}
