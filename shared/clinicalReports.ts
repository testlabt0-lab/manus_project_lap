export const clinicalReportTemplateCodes = ["HOME_VISIT", "NURSING_FOLLOW_UP", "CHRONIC_CARE"] as const;
export type ClinicalReportTemplateCode = (typeof clinicalReportTemplateCodes)[number];

export const clinicalReportTemplateLabels: Record<ClinicalReportTemplateCode, string> = {
  HOME_VISIT: "زيارة منزلية عامة",
  NURSING_FOLLOW_UP: "متابعة تمريضية",
  CHRONIC_CARE: "متابعة رعاية مزمنة",
};

export const clinicalReportTemplateSections: Record<ClinicalReportTemplateCode, readonly string[]> = {
  HOME_VISIT: ["الانطباع العام", "الإجراءات المنفذة", "خطة المتابعة"],
  NURSING_FOLLOW_UP: ["ملاحظات التمريض", "التدخلات", "تعليمات المتابعة"],
  CHRONIC_CARE: ["مؤشرات المتابعة", "الاستجابة الحالية", "الخطة القادمة"],
};
