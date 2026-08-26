export const DEFAULT_VISIT_DURATION_MINUTES = 60;
export const visitDurationOptions = [30, 45, 60, 90, 120] as const;
export type VisitDurationMinutes = (typeof visitDurationOptions)[number];
export const transitionBufferOptions = [0, 15, 30, 45, 60] as const;
export type TransitionBufferMinutes = (typeof transitionBufferOptions)[number];

export type AssignedVisitCandidate = {
  id: number;
  reference: string;
  scheduledStart: Date | string;
  state: string;
};

const blockingAssignmentStates = new Set(["ASSIGNED", "CONFIRMED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS"]);

export function getVisitAssignmentEnd(startAt: Date | string, durationMinutes = DEFAULT_VISIT_DURATION_MINUTES) {
  return new Date(new Date(startAt).getTime() + durationMinutes * 60 * 1000);
}

export function findConflictingAssignedVisit(candidates: AssignedVisitCandidate[], candidateVisitId: number, candidateStartAt: Date | string, durationMinutes = DEFAULT_VISIT_DURATION_MINUTES, transitionBufferMinutes: TransitionBufferMinutes = 0) {
  const candidateStart = new Date(candidateStartAt);
  const candidateEnd = getVisitAssignmentEnd(candidateStart, durationMinutes);
  const bufferedCandidateStart = new Date(candidateStart.getTime() - transitionBufferMinutes * 60 * 1000);
  const bufferedCandidateEnd = new Date(candidateEnd.getTime() + transitionBufferMinutes * 60 * 1000);
  return candidates.find(candidate => {
    if (candidate.id === candidateVisitId || !blockingAssignmentStates.has(candidate.state)) return false;
    const existingStart = new Date(candidate.scheduledStart);
    const existingEnd = getVisitAssignmentEnd(existingStart, durationMinutes);
    return existingStart < bufferedCandidateEnd && existingEnd > bufferedCandidateStart;
  });
}
