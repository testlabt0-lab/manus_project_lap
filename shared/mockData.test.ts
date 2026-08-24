import { describe, expect, it } from "vitest";
import { DEMO_DOCUMENTS, DEMO_VISIT } from "./mockData";

describe("MediCare safe demo data", () => {
  it("uses explicitly synthetic visit labels with the expected UI shape", () => {
    expect(DEMO_VISIT.reference).toMatch(/^V-\d{4}$/);
    expect(DEMO_VISIT.patientLabel).toBe("مريض تجريبي");
    expect(DEMO_VISIT.districtLabel).toContain("حي تجريبي");
    expect(DEMO_VISIT.state).toBe("EN_ROUTE");
  });

  it("does not include obvious phone, email, or real-address patterns in mock records", () => {
    const serialized = JSON.stringify({ DEMO_VISIT, DEMO_DOCUMENTS });
    expect(serialized).not.toMatch(/@/);
    expect(serialized).not.toMatch(/\+?\d[\d\s-]{7,}/);
    expect(serialized).not.toContain("شارع");
  });
});
