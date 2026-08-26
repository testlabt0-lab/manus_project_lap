export const VISIT_ASSIGNMENT_DURATION_MINUTES = 60;

export type AssignedVisitCandidate = {
  id: number;
  reference: string;
  scheduledStart: Date | string;
  state: string;
};

const blockingAssignmentStates = new Set(["ASSIGNED", "CONFIRMED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS"]);

export function getVisitAssignmentEnd(startAt: Date | string) {
  return new Date(new Date(startAt).getTime() + VISIT_ASSIGNMENT_DURATION_MINUTES * 60 * 1000);
}

export function findConflictingAssignedVisit(candidates: AssignedVisitCandidate[], candidateVisitId: number, candidateStartAt: Date | string) {
  const candidateStart = new Date(candidateStartAt);
  const candidateEnd = getVisitAssignmentEnd(candidateStart);
  return candidates.find(candidate => {
    if (candidate.id === candidateVisitId || !blockingAssignmentStates.has(candidate.state)) return false;
    const existingStart = new Date(candidate.scheduledStart);
    const existingEnd = getVisitAssignmentEnd(existingStart);
    return existingStart < candidateEnd && existingEnd > candidateStart;
  });
}
