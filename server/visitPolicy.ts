import type { VisitState } from "../drizzle/schema";

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

export function isAllowedVisitTransition(from: VisitState, to: VisitState) {
  return allowedTransitions[from].includes(to);
}
