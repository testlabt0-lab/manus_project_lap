import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listStaffServiceZones: vi.fn(), setStaffServiceZones: vi.fn(), setVisitServiceZone: vi.fn() }));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, listStaffServiceZones: mocks.listStaffServiceZones, setStaffServiceZones: mocks.setStaffServiceZones, setVisitServiceZone: mocks.setVisitServiceZone };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(role: "admin" | "user"): TrpcContext {
  return { user: { id: role === "admin" ? 151 : 152, openId: `zones-${role}`, name: "مدير تجريبي", email: `${role}@example.test`, loginMethod: "test", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("staff service zones routes", () => {
  it("scopes zones and visit service zone to the administrator identity", async () => {
    mocks.listStaffServiceZones.mockResolvedValue([{ staffUserId: 9, staffName: "ممرض تجريبي", memberRole: "NURSE", zoneCodes: ["NORTH"] }]);
    mocks.setStaffServiceZones.mockResolvedValue({ clinicId: 3, staffUserId: 9, zoneCodes: ["NORTH"] });
    mocks.setVisitServiceZone.mockResolvedValue({ visitId: 18, serviceZone: "NORTH" });
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.staffServiceZones.list({ clinicId: 3 })).resolves.toMatchObject([{ staffUserId: 9 }]);
    await expect(caller.staffServiceZones.set({ clinicId: 3, staffUserId: 9, zoneCodes: ["NORTH"] })).resolves.toMatchObject({ staffUserId: 9 });
    await expect(caller.visits.setServiceZone({ visitId: 18, serviceZone: "NORTH" })).resolves.toMatchObject({ visitId: 18 });
    expect(mocks.listStaffServiceZones).toHaveBeenCalledWith(151, 3);
    expect(mocks.setStaffServiceZones).toHaveBeenCalledWith(151, 3, 9, ["NORTH"]);
    expect(mocks.setVisitServiceZone).toHaveBeenCalledWith(151, 18, "NORTH");
  });

  it("rejects unprivileged management of service zones", async () => {
    const caller = appRouter.createCaller(context("user"));
    await expect(caller.staffServiceZones.list({ clinicId: 3 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.visits.setServiceZone({ visitId: 18, serviceZone: "NORTH" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
