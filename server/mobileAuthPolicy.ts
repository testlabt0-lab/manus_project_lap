import { createHash, randomBytes } from "node:crypto";

export const MOBILE_ACCESS_TOKEN_TTL_MS = 1000 * 60 * 15;
export const MOBILE_AUTH_TTL_MS = 1000 * 60 * 5;
export const MOBILE_REFRESH_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30;
export const MOBILE_REDIRECT_URI = "medicarepro://auth";
export const MOBILE_CLIENT_ID = "medicare-pro-mobile-android";

const PKCE_VALUE = /^[A-Za-z0-9._~-]{43,128}$/;
const APP_STATE_VALUE = /^[A-Za-z0-9._~-]{8,512}$/;

export function isValidMobileRedirectUri(value: unknown): value is string {
  return value === MOBILE_REDIRECT_URI;
}

export function isValidMobileClientId(value: unknown): value is string {
  return value === MOBILE_CLIENT_ID;
}

export function isValidPkceValue(value: unknown): value is string {
  return typeof value === "string" && PKCE_VALUE.test(value);
}

export function isValidMobileState(value: unknown): value is string {
  return typeof value === "string" && APP_STATE_VALUE.test(value);
}

export function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function sha256Base64Url(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

export function createMobileNonce() {
  return randomBytes(32).toString("base64url");
}

export function createMobileAuthorizationCode() {
  return randomBytes(32).toString("base64url");
}

export function createMobileRefreshToken() {
  return randomBytes(48).toString("base64url");
}

export function isExpectedMobileWebOrigin(candidate: unknown, expectedOrigin: string) {
  if (typeof candidate !== "string" || !expectedOrigin) return false;
  try {
    return new URL(candidate).origin === new URL(expectedOrigin).origin;
  } catch {
    return false;
  }
}
