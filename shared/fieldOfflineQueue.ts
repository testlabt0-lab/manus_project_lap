export const fieldActionTypes = ["ARRIVED", "IN_PROGRESS", "COMPLETED"] as const;
export type FieldActionType = (typeof fieldActionTypes)[number];

export type FieldTaskSnapshot = {
  visitId: number;
  reference: string;
  scheduledStart: number;
  state: string;
};

export type FieldQueuedAction = {
  id: string;
  visitId: number;
  reference: string;
  actionType: FieldActionType;
  occurredAt: number;
  syncState: "PENDING" | "SYNCED" | "FAILED";
  attempts: number;
  lastAttemptAt?: number;
  errorCode?: "TEMPORARY_UNAVAILABLE";
};

export function createFieldQueuedAction(input: { visitId: number; reference: string; actionType: FieldActionType; occurredAt?: number }): FieldQueuedAction {
  return {
    id: `${input.visitId}-${input.actionType}-${input.occurredAt ?? Date.now()}`,
    visitId: input.visitId,
    reference: input.reference.slice(0, 40),
    actionType: input.actionType,
    occurredAt: input.occurredAt ?? Date.now(),
    syncState: "PENDING",
    attempts: 0,
  };
}

export function appendFieldAction(queue: readonly FieldQueuedAction[], action: FieldQueuedAction) {
  const withoutDuplicate = queue.filter(item => item.id !== action.id);
  return [...withoutDuplicate, action].slice(-50);
}

export function markFieldActionsSynced(queue: readonly FieldQueuedAction[], ids: readonly string[], now = Date.now()) {
  const idSet = new Set(ids);
  return queue.map(item => idSet.has(item.id) ? { ...item, syncState: "SYNCED" as const, attempts: item.attempts + 1, lastAttemptAt: now, errorCode: undefined } : item);
}

export function markFieldActionsFailed(queue: readonly FieldQueuedAction[], ids: readonly string[], now = Date.now()) {
  const idSet = new Set(ids);
  return queue.map(item => idSet.has(item.id) ? { ...item, syncState: "FAILED" as const, attempts: item.attempts + 1, lastAttemptAt: now, errorCode: "TEMPORARY_UNAVAILABLE" as const } : item);
}

export function retryFieldActions(queue: readonly FieldQueuedAction[], ids: readonly string[]) {
  const idSet = new Set(ids);
  return queue.map(item => idSet.has(item.id) && item.syncState === "FAILED" ? { ...item, syncState: "PENDING" as const, errorCode: undefined } : item);
}

export const fieldQueueStorageKey = "medicare-pro-field-queue-v1";
export const fieldTasksStorageKey = "medicare-pro-field-tasks-v1";
