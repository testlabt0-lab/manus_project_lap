import { describe, expect, it } from "vitest";
import { adminProcedure, router } from "./_core/trpc";
import type { TrpcContext } from "./_core/context";

const testRouter = router({
  administrativeAction: adminProcedure.query(() => ({ success: true })),
});

function createContext(mobileScope?: "patient"): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "patient-on-mobile",
      name: "Patient",
      email: "patient@example.com",
      loginMethod: "mobile",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      mobileScope,
    },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("mobile patient scope", () => {
  it("rejects administrative operations even when the underlying user has an admin role", async () => {
    const caller = testRouter.createCaller(createContext("patient"));
    await expect(caller.administrativeAction()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows ordinary web sessions with administrative role through the existing guard", async () => {
    const caller = testRouter.createCaller(createContext());
    await expect(caller.administrativeAction()).resolves.toEqual({ success: true });
  });
});
