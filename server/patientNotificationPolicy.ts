import type { VisitState } from "../drizzle/schema";

export const patientNotificationKinds = ["VISIT_CREATED", "VISIT_STATUS_CHANGED"] as const;
export type PatientNotificationKind = (typeof patientNotificationKinds)[number];

export function buildVisitCreatedNotification() {
  return {
    kind: "VISIT_CREATED" as const,
    title: "تم إرسال طلب الزيارة",
    body: "تم حفظ طلب الزيارة في حسابك. ستظهر التحديثات هنا عند معالجته.",
  };
}

export function buildVisitStatusNotification(state: VisitState) {
  return {
    kind: "VISIT_STATUS_CHANGED" as const,
    title: "تم تحديث حالة زيارة",
    body: `تغيرت حالة الزيارة إلى: ${state}. افتح التطبيق لعرض التفاصيل المصرح بها.`,
  };
}
