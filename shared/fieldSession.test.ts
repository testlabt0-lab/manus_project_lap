import { describe, expect, it } from "vitest";
import { createFieldSession, fieldSessionDurationMs, isFieldSessionActive } from "./fieldSession";

describe("field session lease", () => {
  it("creates an active lease with a bounded lifetime", () => {
    const session = createFieldSession(1000);
    expect(session.expiresAt).toBe(1000 + fieldSessionDurationMs);
    expect(isFieldSessionActive(session, 1001)).toBe(true);
  });

  it("expires at the lease boundary", () => {
    const session = createFieldSession(1000);
    expect(isFieldSessionActive(session, session.expiresAt)).toBe(false);
  });

  it("does not treat a missing lease as active", () => {
    expect(isFieldSessionActive(null, 1000)).toBe(false);
  });
});
