export const fieldSyncFailureAlertThreshold = 3;

export function shouldAlertOnFieldSyncFailures(failedCount: number, threshold = fieldSyncFailureAlertThreshold) {
  return Number.isFinite(failedCount) && failedCount >= threshold;
}
