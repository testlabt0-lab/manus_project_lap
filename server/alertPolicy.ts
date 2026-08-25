export type OverdueVisitCandidate = {
  id: number;
  reference: string;
  serviceName: string;
  scheduledStart: Date;
  state: string;
};

const ACTIVE_OPERATIONAL_STATES = new Set(["REQUESTED", "ASSIGNED", "EN_ROUTE", "IN_PROGRESS"]);

export function getOverdueVisitAlerts(visits: OverdueVisitCandidate[], graceMinutes: number, now = new Date()) {
  const threshold = now.getTime() - graceMinutes * 60_000;
  return visits
    .filter(visit => ACTIVE_OPERATIONAL_STATES.has(visit.state) && new Date(visit.scheduledStart).getTime() < threshold)
    .map(visit => ({
      visitId: visit.id,
      reference: visit.reference,
      serviceName: visit.serviceName,
      state: visit.state,
      scheduledStart: visit.scheduledStart,
      minutesLate: Math.floor((now.getTime() - new Date(visit.scheduledStart).getTime()) / 60_000),
    }))
    .sort((a, b) => b.minutesLate - a.minutesLate);
}
