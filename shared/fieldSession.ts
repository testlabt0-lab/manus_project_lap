export const fieldSessionDurationMs = 4 * 60 * 60 * 1000;
export const fieldSessionStorageKey = "medicare-pro-field-session-v1";

export type FieldSessionLease = { sessionId: string; expiresAt: number };

export function createFieldSession(now = Date.now()): FieldSessionLease {
  return { sessionId: `field-${now}-${Math.random().toString(36).slice(2, 10)}`, expiresAt: now + fieldSessionDurationMs };
}

export function isFieldSessionActive(session: FieldSessionLease | null, now = Date.now()) {
  return Boolean(session?.sessionId && session.expiresAt > now);
}
