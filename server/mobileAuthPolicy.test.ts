import { describe, expect, it } from "vitest";
import {
  MOBILE_CLIENT_ID,
  MOBILE_REDIRECT_URI,
  isExpectedMobileWebOrigin,
  isValidMobileClientId,
  isValidMobileRedirectUri,
  isValidMobileState,
  isValidPkceValue,
  sha256Base64Url,
  sha256Hex,
} from "./mobileAuthPolicy";

describe("mobile authorization policy", () => {
  it("accepts only the declared Android callback URI", () => {
    expect(isValidMobileRedirectUri(MOBILE_REDIRECT_URI)).toBe(true);
    expect(isValidMobileRedirectUri("https://attacker.example/auth")).toBe(false);
    expect(isValidMobileRedirectUri("medicarepro://other")).toBe(false);
  });

  it("accepts only the registered Android client identifier", () => {
    expect(isValidMobileClientId(MOBILE_CLIENT_ID)).toBe(true);
    expect(isValidMobileClientId("untrusted-client")).toBe(false);
  });

  it("requires constrained state and PKCE values", () => {
    const verifier = "A".repeat(43);
    expect(isValidPkceValue(verifier)).toBe(true);
    expect(isValidPkceValue("short")).toBe(false);
    expect(isValidMobileState("state-12345678")).toBe(true);
    expect(isValidMobileState("state with space")).toBe(false);
  });

  it("compares trusted web origins exactly and derives deterministic code hashes", () => {
    expect(isExpectedMobileWebOrigin("https://medicarepro-myvdwgyk.manus.space", "https://medicarepro-myvdwgyk.manus.space")).toBe(true);
    expect(isExpectedMobileWebOrigin("https://other.manus.space", "https://medicarepro-myvdwgyk.manus.space")).toBe(false);
    expect(sha256Hex("code")).toHaveLength(64);
    expect(sha256Base64Url("verifier")).not.toContain("=");
  });
});
