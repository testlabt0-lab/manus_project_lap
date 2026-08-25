import express from "express";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const stubs = vi.hoisted(() => ({
  getDb: vi.fn(),
  createSessionToken: vi.fn(),
  createMobileAuthSession: vi.fn(),
  createMobileRefreshToken: vi.fn(),
  getActiveMobileRefreshToken: vi.fn(),
  getAuthorizedMobileAuthSession: vi.fn(),
  getMobileAuthUser: vi.fn(),
  getPendingMobileAuthSession: vi.fn(),
  consumeMobileAuthSession: vi.fn(),
  rotateMobileRefreshToken: vi.fn(),
  authorizeMobileAuthSession: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: stubs.getDb }));
vi.mock("./mobileAuthDb", () => ({
  createMobileAuthSession: stubs.createMobileAuthSession,
  createMobileRefreshToken: stubs.createMobileRefreshToken,
  getActiveMobileRefreshToken: stubs.getActiveMobileRefreshToken,
  getAuthorizedMobileAuthSession: stubs.getAuthorizedMobileAuthSession,
  getMobileAuthUser: stubs.getMobileAuthUser,
  getPendingMobileAuthSession: stubs.getPendingMobileAuthSession,
  consumeMobileAuthSession: stubs.consumeMobileAuthSession,
  rotateMobileRefreshToken: stubs.rotateMobileRefreshToken,
  authorizeMobileAuthSession: stubs.authorizeMobileAuthSession,
}));
vi.mock("./_core/sdk", () => ({ sdk: { createSessionToken: stubs.createSessionToken } }));

import { registerMobileAuthRoutes } from "./mobileAuth";
import { MOBILE_CLIENT_ID } from "./mobileAuthPolicy";

const servers: Server[] = [];

async function startTestServer() {
  const app = express();
  app.use(express.json());
  registerMobileAuthRoutes(app);
  const server = await new Promise<Server>(resolve => {
    const listener = app.listen(0, () => resolve(listener));
  });
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not expose a numeric port");
  return `http://127.0.0.1:${address.port}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  stubs.getDb.mockResolvedValue({});
  stubs.getMobileAuthUser.mockResolvedValue({ id: 5, openId: "patient-5", name: "Patient" });
  stubs.createSessionToken.mockResolvedValue("next-access-token");
  stubs.createMobileRefreshToken.mockResolvedValue(undefined);
});

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))));
});

describe("mobile refresh route", () => {
  it("rotates an active refresh token and returns a fresh access and refresh token pair", async () => {
    stubs.getActiveMobileRefreshToken.mockResolvedValue({ userId: 5 });
    stubs.rotateMobileRefreshToken.mockResolvedValue(true);
    const origin = await startTestServer();
    const response = await fetch(`${origin}/api/mobile-auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: MOBILE_CLIENT_ID, refresh_token: "R".repeat(48) }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ access_token: "next-access-token", token_type: "Bearer", expires_in: 900 });
    expect(stubs.rotateMobileRefreshToken).toHaveBeenCalledOnce();
    expect(stubs.createMobileRefreshToken).toHaveBeenCalledOnce();
  });

  it("rejects a refresh token that has already been consumed by a prior rotation", async () => {
    stubs.getActiveMobileRefreshToken.mockResolvedValue({ userId: 5 });
    stubs.rotateMobileRefreshToken.mockResolvedValue(false);
    const origin = await startTestServer();
    const response = await fetch(`${origin}/api/mobile-auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: MOBILE_CLIENT_ID, refresh_token: "R".repeat(48) }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Refresh token has already been used" });
  });

  it("rejects an expired or unknown refresh token before issuing a new session", async () => {
    stubs.getActiveMobileRefreshToken.mockResolvedValue(undefined);
    const origin = await startTestServer();
    const response = await fetch(`${origin}/api/mobile-auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: MOBILE_CLIENT_ID, refresh_token: "R".repeat(48) }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Refresh token is invalid or expired" });
  });
});
