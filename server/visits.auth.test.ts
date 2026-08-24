import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("visits router authentication", () => {
  it("rejects a patient visit list request without an authenticated session", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: {} as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);

    await expect(caller.visits.listMine()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
