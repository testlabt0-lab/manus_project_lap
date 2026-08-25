import { encodeOAuthState } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "./db";
import {
  authorizeMobileAuthSession,
  consumeMobileAuthSession,
  createMobileAuthSession,
  createMobileRefreshToken,
  getActiveMobileRefreshToken,
  getAuthorizedMobileAuthSession,
  getMobileAuthUser,
  getPendingMobileAuthSession,
  rotateMobileRefreshToken,
} from "./mobileAuthDb";
import {
  MOBILE_ACCESS_TOKEN_TTL_MS,
  MOBILE_AUTH_TTL_MS,
  MOBILE_CLIENT_ID,
  MOBILE_REFRESH_TOKEN_TTL_MS,
  createMobileAuthorizationCode,
  createMobileRefreshToken as createRefreshToken,
  createMobileNonce,
  isExpectedMobileWebOrigin,
  isValidMobileClientId,
  isValidMobileRedirectUri,
  isValidMobileState,
  isValidPkceValue,
  sha256Base64Url,
  sha256Hex,
} from "./mobileAuthPolicy";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";

type MobileDb = NonNullable<Awaited<ReturnType<typeof db.getDb>>>;

function getQuery(req: Request, key: string) {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function getDbOrThrow(): Promise<MobileDb> {
  return db.getDb().then(database => {
    if (!database) throw new Error("Database is not available");
    return database;
  });
}

function isConfigured() {
  return Boolean(ENV.mobileWebOrigin && ENV.oAuthPortalUrl && ENV.appId);
}

async function issueMobileTokens(user: { id: number; openId: string; name: string | null }, database: MobileDb) {
  const accessToken = await sdk.createSessionToken(user.openId, {
    name: user.name || "MediCare Pro Mobile",
    expiresInMs: MOBILE_ACCESS_TOKEN_TTL_MS,
    scope: "mobile_patient",
  });
  const refreshToken = createRefreshToken();
  await createMobileRefreshToken(database, {
    tokenHash: sha256Hex(refreshToken),
    userId: user.id,
    clientId: MOBILE_CLIENT_ID,
    expiresAt: new Date(Date.now() + MOBILE_REFRESH_TOKEN_TTL_MS),
  });
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_in: Math.floor(MOBILE_ACCESS_TOKEN_TTL_MS / 1000),
  };
}

export function registerMobileAuthRoutes(app: Express) {
  app.get("/api/mobile-auth/start", async (req: Request, res: Response) => {
    const redirectUri = getQuery(req, "redirect_uri");
    const clientId = getQuery(req, "client_id");
    const state = getQuery(req, "state");
    const codeChallenge = getQuery(req, "code_challenge");
    const webOrigin = getQuery(req, "web_origin");

    if (!isValidMobileClientId(clientId) || !isValidMobileRedirectUri(redirectUri) || !isValidMobileState(state) || !isValidPkceValue(codeChallenge)) {
      res.status(400).json({ error: "Invalid mobile authorization request" });
      return;
    }
    if (!isConfigured()) {
      res.status(503).json({ error: "Mobile authentication is not configured" });
      return;
    }
    if (!isExpectedMobileWebOrigin(webOrigin, ENV.mobileWebOrigin)) {
      res.status(400).json({ error: "Invalid mobile authorization request" });
      return;
    }

    try {
      const nonce = createMobileNonce();
      const expiresAt = new Date(Date.now() + MOBILE_AUTH_TTL_MS);
      const database = await getDbOrThrow();
      await createMobileAuthSession(database, { nonce, appRedirectUri: redirectUri, appState: state, codeChallenge, expiresAt });

      res.cookie("__Host-oauth_state", nonce, { ...getSessionCookieOptions(req), httpOnly: true, maxAge: MOBILE_AUTH_TTL_MS });
      const callbackUrl = `${ENV.mobileWebOrigin}/api/oauth/callback`;
      const oauthState = encodeOAuthState({ redirectUri: callbackUrl, nonce });
      const portalUrl = new URL("/app-auth", ENV.oAuthPortalUrl);
      portalUrl.searchParams.set("app_id", ENV.appId);
      portalUrl.searchParams.set("redirect_url", callbackUrl);
      portalUrl.searchParams.set("state", oauthState);
      portalUrl.searchParams.set("type", "signIn");
      res.redirect(302, portalUrl.toString());
    } catch (error) {
      console.error("[MobileAuth] Unable to start mobile authorization", error);
      res.status(500).json({ error: "Unable to start mobile authorization" });
    }
  });

  app.post("/api/mobile-auth/token", async (req: Request, res: Response) => {
    const code = req.body?.code;
    const codeVerifier = req.body?.code_verifier;
    const clientId = req.body?.client_id;
    if (!isValidMobileClientId(clientId) || typeof code !== "string" || !isValidPkceValue(codeVerifier)) {
      res.status(400).json({ error: "Invalid authorization code exchange" });
      return;
    }

    try {
      const database = await getDbOrThrow();
      const codeHash = sha256Hex(code);
      const session = await getAuthorizedMobileAuthSession(database, codeHash);
      if (!session || !session.userId || sha256Base64Url(codeVerifier) !== session.codeChallenge) {
        res.status(400).json({ error: "Authorization code is invalid or expired" });
        return;
      }
      const consumed = await consumeMobileAuthSession(database, codeHash);
      if (!consumed) {
        res.status(400).json({ error: "Authorization code has already been used" });
        return;
      }
      const user = await getMobileAuthUser(database, session.userId);
      if (!user) {
        res.status(401).json({ error: "User is not available" });
        return;
      }
      res.setHeader("Cache-Control", "no-store");
      res.json(await issueMobileTokens(user, database));
    } catch (error) {
      console.error("[MobileAuth] Unable to exchange mobile authorization code", error);
      res.status(500).json({ error: "Unable to exchange mobile authorization code" });
    }
  });

  app.post("/api/mobile-auth/refresh", async (req: Request, res: Response) => {
    const clientId = req.body?.client_id;
    const refreshToken = req.body?.refresh_token;
    if (!isValidMobileClientId(clientId) || typeof refreshToken !== "string" || refreshToken.length < 32) {
      res.status(400).json({ error: "Invalid refresh token request" });
      return;
    }
    try {
      const database = await getDbOrThrow();
      const tokenHash = sha256Hex(refreshToken);
      const existing = await getActiveMobileRefreshToken(database, { tokenHash, clientId });
      if (!existing) {
        res.status(400).json({ error: "Refresh token is invalid or expired" });
        return;
      }
      const rotated = await rotateMobileRefreshToken(database, { tokenHash, clientId });
      if (!rotated) {
        res.status(400).json({ error: "Refresh token has already been used" });
        return;
      }
      const user = await getMobileAuthUser(database, existing.userId);
      if (!user) {
        res.status(401).json({ error: "User is not available" });
        return;
      }
      res.setHeader("Cache-Control", "no-store");
      res.json(await issueMobileTokens(user, database));
    } catch (error) {
      console.error("[MobileAuth] Unable to refresh mobile session", error);
      res.status(500).json({ error: "Unable to refresh mobile session" });
    }
  });
}

export async function completeMobileAuthorization(input: { nonce: string; userId: number }) {
  const database = await getDbOrThrow();
  const pending = await getPendingMobileAuthSession(database, input.nonce);
  if (!pending) return undefined;
  const authorizationCode = createMobileAuthorizationCode();
  const session = await authorizeMobileAuthSession(database, {
    nonce: input.nonce,
    userId: input.userId,
    authorizationCodeHash: sha256Hex(authorizationCode),
  });
  if (!session) return undefined;
  return { authorizationCode, appRedirectUri: session.appRedirectUri, appState: session.appState };
}
