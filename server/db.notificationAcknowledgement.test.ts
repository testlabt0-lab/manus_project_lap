import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  process.env.DATABASE_URL = "mysql://unit.test/medicare";
  const notificationUpdateWhere = vi.fn(async () => undefined);
  const auditInsertValues = vi.fn(async () => undefined);
  const tx = {
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: notificationUpdateWhere })) })),
    insert: vi.fn(() => ({ values: auditInsertValues })),
  };
  return { auditInsertValues, db: { select: vi.fn(), transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<void>) => callback(tx)) }, notificationUpdateWhere, tx };
});

vi.mock("drizzle-orm/mysql2", () => ({ drizzle: () => mocks.db }));

import { acknowledgeManagerNotification } from "./db";

function selectRows(rows: unknown[]) {
  const chain = {
    limit: vi.fn(async () => rows),
    then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(rows).then(resolve, reject),
  };
  return { from: vi.fn(() => ({ where: vi.fn(() => chain) })) };
}

describe("database notification acknowledgement audit", () => {
  beforeEach(() => {
    mocks.db.select.mockReset();
    mocks.db.transaction.mockClear();
    mocks.tx.update.mockClear();
    mocks.tx.insert.mockClear();
    mocks.notificationUpdateWhere.mockClear();
    mocks.auditInsertValues.mockClear();
  });

  it("records one clinic-scoped audit event when a manager acknowledges an unread notification", async () => {
    mocks.db.select
      .mockReturnValueOnce(selectRows([{ id: 45, clinicId: 3, managerUserId: 71, acknowledgedAt: null }]))
      .mockReturnValueOnce(selectRows([{ userId: 71, clinicId: 3, memberRole: "MANAGER", status: "ACTIVE" }]));

    await expect(acknowledgeManagerNotification(71, 45)).resolves.toMatchObject({ id: 45, clinicId: 3 });
    expect(mocks.db.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.auditInsertValues).toHaveBeenCalledWith(expect.objectContaining({
      clinicId: 3,
      actorUserId: 71,
      eventType: "NOTIFICATION_ACKNOWLEDGED",
      resourceType: "MANAGER_NOTIFICATION",
      resourceId: 45,
    }));
  });

  it("does not write a second audit event when the notification was already acknowledged", async () => {
    const acknowledgedAt = new Date("2026-08-25T12:00:00.000Z");
    mocks.db.select
      .mockReturnValueOnce(selectRows([{ id: 45, clinicId: 3, managerUserId: 71, acknowledgedAt }]))
      .mockReturnValueOnce(selectRows([{ userId: 71, clinicId: 3, memberRole: "MANAGER", status: "ACTIVE" }]));

    await expect(acknowledgeManagerNotification(71, 45)).resolves.toMatchObject({ id: 45, acknowledgedAt });
    expect(mocks.db.transaction).not.toHaveBeenCalled();
    expect(mocks.auditInsertValues).not.toHaveBeenCalled();
  });
});
