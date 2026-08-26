import { describe, expect, it } from "vitest";
import { appendFieldAction, createFieldQueuedAction, markFieldActionsSynced } from "./fieldOfflineQueue";

describe("field offline queue", () => {
  it("creates a sanitized pending action without patient details", () => {
    const action = createFieldQueuedAction({ visitId: 12, reference: "V-1024", actionType: "ARRIVED", occurredAt: 1000 });
    expect(action).toMatchObject({ visitId: 12, reference: "V-1024", actionType: "ARRIVED", occurredAt: 1000, syncState: "PENDING" });
    expect(action).not.toHaveProperty("patientName");
    expect(action).not.toHaveProperty("address");
  });

  it("deduplicates actions and keeps the most recent fifty entries", () => {
    const first = createFieldQueuedAction({ visitId: 12, reference: "V-1024", actionType: "ARRIVED", occurredAt: 1000 });
    let queue = appendFieldAction([], first);
    queue = appendFieldAction(queue, first);
    expect(queue).toHaveLength(1);
    for (let index = 0; index < 55; index += 1) queue = appendFieldAction(queue, createFieldQueuedAction({ visitId: index, reference: `V-${index}`, actionType: "IN_PROGRESS", occurredAt: index + 2000 }));
    expect(queue).toHaveLength(50);
  });

  it("marks only acknowledged action ids as synced", () => {
    const pending = createFieldQueuedAction({ visitId: 1, reference: "V-1", actionType: "COMPLETED", occurredAt: 20 });
    const other = createFieldQueuedAction({ visitId: 2, reference: "V-2", actionType: "ARRIVED", occurredAt: 21 });
    const updated = markFieldActionsSynced([pending, other], [pending.id]);
    expect(updated[0].syncState).toBe("SYNCED");
    expect(updated[1].syncState).toBe("PENDING");
  });
});
