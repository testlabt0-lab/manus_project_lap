import type { VisitState } from "./medicare";

/**
 * Deliberately non-production content for prototype screens only.
 * These values are safe labels, not patient records, addresses, phone numbers, or medical reports.
 */
export const DEMO_VISIT: {
  reference: string;
  patientLabel: string;
  clinicLabel: string;
  serviceName: string;
  scheduledLabel: string;
  districtLabel: string;
  state: VisitState;
} = {
  reference: "V-1024",
  patientLabel: "مريض تجريبي",
  clinicLabel: "عيادة الحياة",
  serviceName: "طب عام في المنزل",
  scheduledLabel: "الإثنين، 26 مايو · 10:00 ص",
  districtLabel: "حي تجريبي · الرياض",
  state: "EN_ROUTE",
};

export const DEMO_DOCUMENTS = [
  { id: "dfd", kind: "DFD", title: "مخطط تدفق البيانات" },
  { id: "sequence", kind: "SEQUENCE", title: "مخطط تسلسل الزيارة" },
  { id: "erd", kind: "ERD", title: "مخطط قاعدة البيانات" },
] as const;
