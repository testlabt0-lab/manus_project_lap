import { describe, expect, it } from "vitest";
import { buildVisitCreatedNotification, buildVisitStatusNotification } from "./patientNotificationPolicy";

describe("patient notification policy", () => {
  it("creates a general visit request notice without sensitive medical detail", () => {
    const notice = buildVisitCreatedNotification();
    expect(notice).toMatchObject({ kind: "VISIT_CREATED", title: "تم إرسال طلب الزيارة" });
    expect(notice.body).not.toMatch(/تشخيص|نتيجة|وصفة/);
  });

  it("creates a general status notice that directs the patient to the authorized app view", () => {
    const notice = buildVisitStatusNotification("CONFIRMED");
    expect(notice).toMatchObject({ kind: "VISIT_STATUS_CHANGED" });
    expect(notice.body).toContain("CONFIRMED");
    expect(notice.body).toContain("التفاصيل المصرح بها");
  });
});
