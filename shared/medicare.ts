export const visitStates = [
  "REQUESTED",
  "ASSIGNED",
  "CONFIRMED",
  "EN_ROUTE",
  "ARRIVED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

export type VisitState = (typeof visitStates)[number];

export const visitStateMeta: Record<VisitState, { label: string; tone: "neutral" | "info" | "warning" | "success" | "danger" }> = {
  REQUESTED: { label: "بانتظار المراجعة", tone: "warning" },
  ASSIGNED: { label: "تم تعيين الفريق", tone: "info" },
  CONFIRMED: { label: "مؤكدة", tone: "info" },
  EN_ROUTE: { label: "الفريق في الطريق", tone: "info" },
  ARRIVED: { label: "تم الوصول", tone: "info" },
  IN_PROGRESS: { label: "قيد التنفيذ", tone: "warning" },
  COMPLETED: { label: "مكتملة", tone: "success" },
  CANCELLED: { label: "ملغاة", tone: "danger" },
};

const allowedTransitions: Record<VisitState, VisitState[]> = {
  REQUESTED: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["EN_ROUTE", "CANCELLED"],
  EN_ROUTE: ["ARRIVED"],
  ARRIVED: ["IN_PROGRESS"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionVisit(from: VisitState, to: VisitState) {
  return allowedTransitions[from].includes(to);
}

export function nextVisitState(state: VisitState): VisitState | null {
  return allowedTransitions[state].find(candidate => candidate !== "CANCELLED") ?? null;
}

export function progressForVisit(state: VisitState) {
  const order: VisitState[] = ["REQUESTED", "ASSIGNED", "CONFIRMED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS", "COMPLETED"];
  if (state === "CANCELLED") return 0;
  const current = order.indexOf(state);
  return Math.round((current / (order.length - 1)) * 100);
}

export function canReadPatientVisitOutput(state: VisitState, capability = true) {
  return state === "COMPLETED" && capability;
}
