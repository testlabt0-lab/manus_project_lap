import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listStaffServiceSkills: vi.fn(), setStaffServiceSkills: vi.fn(), setVisitRequiredStaffSkill: vi.fn() }));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, listStaffServiceSkills: mocks.listStaffServiceSkills, setStaffServiceSkills: mocks.setStaffServiceSkills, setVisitRequiredStaffSkill: mocks.setVisitRequiredStaffSkill };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(role: "admin" | "user"): TrpcContext {
  return { user: { id: role === "admin" ? 141 : 142, openId: `skills-${role}`, name: "مدير تجريبي", email: `${role}@example.test`, loginMethod: "test", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("staff skills routes", () => {
  it("scopes staff skills and visit requirements to the administrator identity", async () => {
    mocks.listStaffServiceSkills.mockResolvedValue([{ staffUserId: 8, staffName: "ممارس تجريبي", memberRole: "CLINICIAN", skillCodes: ["MOBILITY_ASSISTANCE"] }]);
    mocks.setStaffServiceSkills.mockResolvedValue({ clinicId: 2, staffUserId: 8, skillCodes: ["MOBILITY_ASSISTANCE"] });
    mocks.setVisitRequiredStaffSkill.mockResolvedValue({ visitId: 17, requiredStaffSkill: "MOBILITY_ASSISTANCE" });
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.staffSkills.list({ clinicId: 2 })).resolves.toMatchObject([{ staffUserId: 8 }]);
    await expect(caller.staffSkills.set({ clinicId: 2, staffUserId: 8, skillCodes: ["MOBILITY_ASSISTANCE"] })).resolves.toMatchObject({ staffUserId: 8 });
    await expect(caller.visits.setRequiredStaffSkill({ visitId: 17, requiredStaffSkill: "MOBILITY_ASSISTANCE" })).resolves.toMatchObject({ visitId: 17 });
    expect(mocks.listStaffServiceSkills).toHaveBeenCalledWith(141, 2);
    expect(mocks.setStaffServiceSkills).toHaveBeenCalledWith(141, 2, 8, ["MOBILITY_ASSISTANCE"]);
    expect(mocks.setVisitRequiredStaffSkill).toHaveBeenCalledWith(141, 17, "MOBILITY_ASSISTANCE");
  });

  it("rejects an unprivileged user from managing operational skill criteria", async () => {
    const caller = appRouter.createCaller(context("user"));
    await expect(caller.staffSkills.list({ clinicId: 2 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.visits.setRequiredStaffSkill({ visitId: 17, requiredStaffSkill: "MOBILITY_ASSISTANCE" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
