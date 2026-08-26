import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getClinicVisitDurationSetting: vi.fn(), setClinicVisitDurationSetting: vi.fn() }));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, getClinicVisitDurationSetting: mocks.getClinicVisitDurationSetting, setClinicVisitDurationSetting: mocks.setClinicVisitDurationSetting };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(role: "admin" | "user"): TrpcContext {
  return { user: { id: role === "admin" ? 91 : 92, openId: `duration-${role}`, name: "مدير تجريبي", email: `${role}@example.test`, loginMethod: "test", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("visit duration routes", () => {
  it("reads and saves an allowed clinic duration through the administrator identity", async () => {
    mocks.getClinicVisitDurationSetting.mockResolvedValue({ clinicId: 2, clinicName: "عيادة تجريبية", durationMinutes: 60 });
    mocks.setClinicVisitDurationSetting.mockResolvedValue({ clinicId: 2, clinicName: "عيادة تجريبية", durationMinutes: 90 });
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.visitDuration.get({ clinicId: 2 })).resolves.toMatchObject({ durationMinutes: 60 });
    await expect(caller.visitDuration.set({ clinicId: 2, durationMinutes: 90 })).resolves.toMatchObject({ durationMinutes: 90 });
    expect(mocks.getClinicVisitDurationSetting).toHaveBeenCalledWith(91, 2);
    expect(mocks.setClinicVisitDurationSetting).toHaveBeenCalledWith(91, 2, 90);
  });

  it("rejects duration settings for a non-administrator", async () => {
    const caller = appRouter.createCaller(context("user"));
    await expect(caller.visitDuration.get({ clinicId: 2 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.visitDuration.set({ clinicId: 2, durationMinutes: 60 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
