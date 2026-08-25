import express from "express";
import type { Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { registerMobileAuthRoutes } from "./mobileAuth";

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

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))));
});

describe("mobile authorization routes", () => {
  it("rejects an unregistered Android client before starting authorization", async () => {
    const origin = await startTestServer();
    const response = await fetch(`${origin}/api/mobile-auth/start?client_id=untrusted-client&redirect_uri=medicarepro%3A%2F%2Fauth&state=patient-state-123456&code_challenge=${"A".repeat(43)}&web_origin=https%3A%2F%2Fmedicarepro-myvdwgyk.manus.space`);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid mobile authorization request" });
  });

  it("rejects an unregistered Android client before processing an authorization code", async () => {
    const origin = await startTestServer();
    const response = await fetch(`${origin}/api/mobile-auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: "untrusted-client", code: "ignored", code_verifier: "A".repeat(43) }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid authorization code exchange" });
  });

  it("rejects an unregistered Android client before processing a refresh token", async () => {
    const origin = await startTestServer();
    const response = await fetch(`${origin}/api/mobile-auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: "untrusted-client", refresh_token: "A".repeat(48) }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid refresh token request" });
  });
});
