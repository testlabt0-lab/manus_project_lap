import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  process.env.DATABASE_URL = "mysql://unit.test/medicare";
  return { db: { select: vi.fn() } };
});

vi.mock("drizzle-orm/mysql2", () => ({ drizzle: () => mocks.db }));

import { assignVisit, listAssignedVisitsForUser } from "./db";

function selectRows(rows: unknown[]) {
  const chain = {
    limit: vi.fn(async () => rows),
    orderBy: vi.fn(async () => rows),
    then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(rows).then(resolve, reject),
  };
  return { from: vi.fn(() => ({ where: vi.fn(() => chain) })) };
}

describe("database membership scope", () => {
  beforeEach(() => mocks.db.select.mockReset());

  it("rejects assignment to an inactive clinician before any write", async () => {
    mocks.db.select
      .mockReturnValueOnce(selectRows([{ id: 40, clinicId: 1, state: "REQUESTED" }]))
      .mockReturnValueOnce(selectRows([{ userId: 1, clinicId: 1, memberRole: "MANAGER", status: "ACTIVE" }]))
      .mockReturnValueOnce(selectRows([{ userId: 2, clinicId: 1, memberRole: "CLINICIAN", status: "INACTIVE" }]));

    await expect(assignVisit({ visitId: 40, assignedByUserId: 1, assigneeUserId: 2, assigneeLabel: "عضو غير نشط" })).resolves.toBeUndefined();
    expect(mocks.db.select).toHaveBeenCalledTimes(3);
  });

  it("rejects assignment to staff whose membership belongs to another clinic", async () => {
    mocks.db.select
      .mockReturnValueOnce(selectRows([{ id: 41, clinicId: 1, state: "REQUESTED" }]))
      .mockReturnValueOnce(selectRows([{ userId: 1, clinicId: 1, memberRole: "MANAGER", status: "ACTIVE" }]))
      .mockReturnValueOnce(selectRows([{ userId: 3, clinicId: 2, memberRole: "CLINICIAN", status: "ACTIVE" }]));

    await expect(assignVisit({ visitId: 41, assignedByUserId: 1, assigneeUserId: 3, assigneeLabel: "عضو من عيادة أخرى" })).resolves.toBeUndefined();
    expect(mocks.db.select).toHaveBeenCalledTimes(3);
  });

  it("returns no assigned visits when the current membership is inactive", async () => {
    mocks.db.select.mockReturnValueOnce(selectRows([{ userId: 2, clinicId: 1, memberRole: "CLINICIAN", status: "INACTIVE" }]));

    await expect(listAssignedVisitsForUser(2)).resolves.toEqual([]);
    expect(mocks.db.select).toHaveBeenCalledTimes(1);
  });
});
