import { and, desc, eq, gte, inArray, like, lt, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, type VisitState, auditEventTypes, auditEvents, clinicMemberships, clinicVisitDurationSettings, invoices, managerNotificationAnalyticsSnapshots, managerNotificationPreferences, managerNotifications, medicalReports, patientNotifications, payments, staffAvailabilityWindows, users, visitAssignments, visits, visitStatusHistory } from "../drizzle/schema";
import { staffWeeklyCapacitySettings } from "../drizzle/schema";
import { ENV } from './_core/env';
import { isEligibleAssigneeMembership } from "./staffPolicy";
import { hasAvailabilityOverlap } from "./staffAvailabilityPolicy";
import { DEFAULT_VISIT_DURATION_MINUTES, findConflictingAssignedVisit, transitionBufferOptions, visitDurationOptions, type TransitionBufferMinutes, type VisitDurationMinutes } from "./visitAssignmentPolicy";
import { summarizeWeeklyWorkloads, type WeeklyAssignmentForWorkload } from "./weeklyWorkloadPolicy";
import { getOverdueVisitAlerts } from "./alertPolicy";
import { buildVisitCreatedNotification, buildVisitStatusNotification } from "./patientNotificationPolicy";
import { buildNotificationResponseComparison, buildNotificationResponseReport, buildNotificationResponseThresholdAlert, buildNotificationResponseTrend } from "./notificationResponsePolicy";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
    if (user.openId === ENV.ownerOpenId) {
      const storedUser = await getUserByOpenId(user.openId);
      if (storedUser) {
        const existingMembership = await db.select().from(clinicMemberships).where(and(eq(clinicMemberships.userId, storedUser.id), eq(clinicMemberships.clinicId, 1))).limit(1);
        if (!existingMembership[0]) {
          await db.insert(clinicMemberships).values({ clinicId: 1, clinicName: "عيادة الحياة", userId: storedUser.id, memberRole: "MANAGER", status: "ACTIVE" });
        }
      }
    }
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function listVisitsForPatient(patientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(visits).where(eq(visits.patientId, patientId)).orderBy(desc(visits.scheduledStart));
}

export async function listOperationalVisits(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const memberships = await db.select().from(clinicMemberships).where(and(eq(clinicMemberships.userId, userId), eq(clinicMemberships.status, "ACTIVE")));
  const clinicIds = memberships.map(membership => membership.clinicId);
  if (clinicIds.length === 0) return [];
  return db.select().from(visits).where(inArray(visits.clinicId, clinicIds)).orderBy(desc(visits.scheduledStart));
}

export async function listWeeklyAssignmentsForManager(managerUserId: number, clinicId: number, weekStart: Date) {
  const db = await getDb();
  if (!db) return undefined;
  const [membership] = await db.select({ clinicId: clinicMemberships.clinicId, clinicName: clinicMemberships.clinicName }).from(clinicMemberships).where(and(eq(clinicMemberships.userId, managerUserId), eq(clinicMemberships.clinicId, clinicId), eq(clinicMemberships.status, "ACTIVE"), eq(clinicMemberships.memberRole, "MANAGER"))).limit(1);
  if (!membership) return undefined;
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const rows = await db.select({ visitId: visits.id, reference: visits.reference, scheduledStart: visits.scheduledStart, state: visits.state, assigneeUserId: visitAssignments.assigneeUserId, assigneeLabel: visitAssignments.assigneeLabel }).from(visits).innerJoin(visitAssignments, eq(visitAssignments.visitId, visits.id)).where(and(eq(visits.clinicId, clinicId), gte(visits.scheduledStart, weekStart), lt(visits.scheduledStart, weekEnd))).orderBy(visits.scheduledStart).limit(100);
  const workloadRows = rows.reduce<WeeklyAssignmentForWorkload[]>((items, row) => {
    if (row.assigneeUserId !== null) items.push({ assigneeUserId: row.assigneeUserId, assigneeLabel: row.assigneeLabel, state: row.state });
    return items;
  }, []);
  return { clinicId, clinicName: membership.clinicName, weekStart, rows, workloads: summarizeWeeklyWorkloads(workloadRows) };
}

export async function listStaffWeeklyCapacitySettings(managerUserId: number, clinicId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [managerMembership] = await db.select({ clinicId: clinicMemberships.clinicId }).from(clinicMemberships).where(and(eq(clinicMemberships.userId, managerUserId), eq(clinicMemberships.clinicId, clinicId), eq(clinicMemberships.status, "ACTIVE"), eq(clinicMemberships.memberRole, "MANAGER"))).limit(1);
  if (!managerMembership) return undefined;
  const staffRows = await db.select({ staffUserId: clinicMemberships.userId, staffName: users.name, memberRole: clinicMemberships.memberRole }).from(clinicMemberships).innerJoin(users, eq(users.id, clinicMemberships.userId)).where(and(eq(clinicMemberships.clinicId, clinicId), eq(clinicMemberships.status, "ACTIVE"), inArray(clinicMemberships.memberRole, ["CLINICIAN", "NURSE"])));
  const settings = await db.select({ staffUserId: staffWeeklyCapacitySettings.staffUserId, targetActiveAssignments: staffWeeklyCapacitySettings.targetActiveAssignments }).from(staffWeeklyCapacitySettings).where(eq(staffWeeklyCapacitySettings.clinicId, clinicId));
  const byStaffId = new Map(settings.map(setting => [setting.staffUserId, setting.targetActiveAssignments]));
  return staffRows.map(staff => ({ ...staff, targetActiveAssignments: byStaffId.get(staff.staffUserId) ?? 5 }));
}

export async function setStaffWeeklyCapacitySetting(managerUserId: number, clinicId: number, staffUserId: number, targetActiveAssignments: number) {
  if (!Number.isInteger(targetActiveAssignments) || targetActiveAssignments < 1 || targetActiveAssignments > 20) return undefined;
  const db = await getDb();
  if (!db) return undefined;
  const [managerMembership] = await db.select({ clinicId: clinicMemberships.clinicId }).from(clinicMemberships).where(and(eq(clinicMemberships.userId, managerUserId), eq(clinicMemberships.clinicId, clinicId), eq(clinicMemberships.status, "ACTIVE"), eq(clinicMemberships.memberRole, "MANAGER"))).limit(1);
  if (!managerMembership) return undefined;
  const [staffMembership] = await db.select({ userId: clinicMemberships.userId }).from(clinicMemberships).where(and(eq(clinicMemberships.userId, staffUserId), eq(clinicMemberships.clinicId, clinicId), eq(clinicMemberships.status, "ACTIVE"), inArray(clinicMemberships.memberRole, ["CLINICIAN", "NURSE"]))).limit(1);
  if (!staffMembership) return undefined;
  await db.insert(staffWeeklyCapacitySettings).values({ clinicId, staffUserId, targetActiveAssignments, updatedByUserId: managerUserId }).onDuplicateKeyUpdate({ set: { targetActiveAssignments, updatedByUserId: managerUserId, updatedAt: new Date() } });
  return { clinicId, staffUserId, targetActiveAssignments };
}

export async function listManagedNotificationClinics(managerUserId: number) {
  const db = await getDb();
  if (!db) return [];
  const memberships = await db.select({ clinicId: clinicMemberships.clinicId, clinicName: clinicMemberships.clinicName }).from(clinicMemberships).where(and(eq(clinicMemberships.userId, managerUserId), eq(clinicMemberships.status, "ACTIVE"), eq(clinicMemberships.memberRole, "MANAGER")));
  return Array.from(new Map(memberships.map(membership => [membership.clinicId, membership])).values());
}

export async function listManagerNotifications(managerUserId: number, clinicId?: number) {
  const db = await getDb();
  if (!db) return [];
  const managerMemberships = await db.select().from(clinicMemberships).where(and(eq(clinicMemberships.userId, managerUserId), eq(clinicMemberships.status, "ACTIVE"), eq(clinicMemberships.memberRole, "MANAGER")));
  const clinicIds = managerMemberships.map(membership => membership.clinicId);
  if (clinicIds.length === 0) return [];
  const scopedClinicIds = clinicId === undefined ? clinicIds : clinicIds.includes(clinicId) ? [clinicId] : [];
  if (scopedClinicIds.length === 0) return [];
  const scopedVisits = await db.select().from(visits).where(inArray(visits.clinicId, scopedClinicIds)).orderBy(desc(visits.scheduledStart));
  const overdue = getOverdueVisitAlerts(scopedVisits, 30);
  const existing = await db.select().from(managerNotifications).where(and(eq(managerNotifications.managerUserId, managerUserId), inArray(managerNotifications.clinicId, scopedClinicIds)));
  const notifiedVisitIds = new Set(existing.filter(notification => notification.notificationType === "OVERDUE_VISIT").map(notification => notification.visitId));
  for (const alert of overdue) {
    if (notifiedVisitIds.has(alert.visitId)) continue;
    const visit = scopedVisits.find(candidate => candidate.id === alert.visitId);
    if (!visit) continue;
    await db.insert(managerNotifications).values({
      clinicId: visit.clinicId,
      managerUserId,
      visitId: alert.visitId,
      notificationType: "OVERDUE_VISIT",
      title: `زيارة متأخرة: ${alert.reference}`,
      message: `تجاوزت الزيارة مهلة المتابعة بمدة ${alert.minutesLate} دقيقة.`,
    });
  }
  return db.select().from(managerNotifications).where(and(eq(managerNotifications.managerUserId, managerUserId), inArray(managerNotifications.clinicId, scopedClinicIds))).orderBy(desc(managerNotifications.createdAt)).limit(30);
}

export async function getManagerNotificationResponseReport(managerUserId: number, days = 30, clinicId?: number) {
  const notifications = await listManagerNotifications(managerUserId, clinicId);
  return buildNotificationResponseReport(notifications, days);
}

async function getActiveManagerClinicMembership(managerUserId: number, clinicId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [membership] = await db.select({ clinicId: clinicMemberships.clinicId, clinicName: clinicMemberships.clinicName }).from(clinicMemberships).where(and(eq(clinicMemberships.userId, managerUserId), eq(clinicMemberships.clinicId, clinicId), eq(clinicMemberships.status, "ACTIVE"), eq(clinicMemberships.memberRole, "MANAGER"))).limit(1);
  return membership;
}

export async function captureManagerNotificationAnalyticsSnapshot(managerUserId: number, clinicId: number, days: 7 | 30 | 90) {
  const db = await getDb();
  if (!db) return undefined;
  const membership = await getActiveManagerClinicMembership(managerUserId, clinicId);
  if (!membership) return undefined;
  const report = await getManagerNotificationResponseReport(managerUserId, days, clinicId);
  const capturedAt = new Date();
  await db.insert(managerNotificationAnalyticsSnapshots).values({ managerUserId, clinicId, periodDays: days, total: report.total, pending: report.pending, acknowledged: report.acknowledged, acknowledgementRate: report.acknowledgementRate, averageResponseMinutes: report.averageResponseMinutes, capturedAt });
  return { clinicId, clinicName: membership.clinicName, periodDays: days, ...report, capturedAt };
}

export async function listManagerNotificationAnalyticsSnapshots(managerUserId: number, clinicId: number, limit = 5) {
  const db = await getDb();
  if (!db) return undefined;
  const membership = await getActiveManagerClinicMembership(managerUserId, clinicId);
  if (!membership) return undefined;
  const snapshots = await db.select().from(managerNotificationAnalyticsSnapshots).where(and(eq(managerNotificationAnalyticsSnapshots.managerUserId, managerUserId), eq(managerNotificationAnalyticsSnapshots.clinicId, clinicId))).orderBy(desc(managerNotificationAnalyticsSnapshots.capturedAt)).limit(limit);
  return snapshots.map(snapshot => ({ ...snapshot, clinicName: membership.clinicName }));
}

export async function getManagerNotificationResponseComparison(managerUserId: number, days = 30, clinicId?: number) {
  return buildNotificationResponseComparison(await listManagerNotifications(managerUserId, clinicId), days);
}

export async function getManagerNotificationResponseTrend(managerUserId: number, days = 30, clinicId?: number) {
  return buildNotificationResponseTrend(await listManagerNotifications(managerUserId, clinicId), days);
}

export async function getManagerNotificationResponseThresholdAlert(managerUserId: number, days = 30, minimumAcknowledgementRate = 70, clinicId?: number) {
  return buildNotificationResponseThresholdAlert(await listManagerNotifications(managerUserId, clinicId), days, minimumAcknowledgementRate);
}

export async function getManagerNotificationResponsePreference(managerUserId: number, clinicId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [membership] = await db.select({ clinicId: clinicMemberships.clinicId }).from(clinicMemberships).where(and(eq(clinicMemberships.userId, managerUserId), eq(clinicMemberships.clinicId, clinicId), eq(clinicMemberships.status, "ACTIVE"), eq(clinicMemberships.memberRole, "MANAGER"))).limit(1);
  if (!membership) return undefined;
  const [preference] = await db.select({ minimumAcknowledgementRate: managerNotificationPreferences.minimumAcknowledgementRate }).from(managerNotificationPreferences).where(and(eq(managerNotificationPreferences.managerUserId, managerUserId), eq(managerNotificationPreferences.clinicId, clinicId))).limit(1);
  return { minimumAcknowledgementRate: preference?.minimumAcknowledgementRate ?? 70 };
}

export async function setManagerNotificationResponsePreference(managerUserId: number, clinicId: number, minimumAcknowledgementRate: 50 | 60 | 70 | 80 | 90) {
  const db = await getDb();
  if (!db) return undefined;
  const [membership] = await db.select({ clinicId: clinicMemberships.clinicId }).from(clinicMemberships).where(and(eq(clinicMemberships.userId, managerUserId), eq(clinicMemberships.clinicId, clinicId), eq(clinicMemberships.status, "ACTIVE"), eq(clinicMemberships.memberRole, "MANAGER"))).limit(1);
  if (!membership) return undefined;
  const [existing] = await db.select({ minimumAcknowledgementRate: managerNotificationPreferences.minimumAcknowledgementRate }).from(managerNotificationPreferences).where(and(eq(managerNotificationPreferences.managerUserId, managerUserId), eq(managerNotificationPreferences.clinicId, clinicId))).limit(1);
  const previousRate = existing?.minimumAcknowledgementRate ?? 70;
  if (previousRate === minimumAcknowledgementRate) return { minimumAcknowledgementRate };
  await db.insert(managerNotificationPreferences).values({ managerUserId, clinicId, minimumAcknowledgementRate }).onDuplicateKeyUpdate({ set: { minimumAcknowledgementRate, updatedAt: new Date() } });
  await db.insert(auditEvents).values({ clinicId, actorUserId: managerUserId, eventType: "NOTIFICATION_THRESHOLD_CHANGED", resourceType: "NOTIFICATION_THRESHOLD", resourceId: clinicId, summary: `تم تغيير عتبة تأكيد الإشعارات من ${previousRate}% إلى ${minimumAcknowledgementRate}%.` });
  return { minimumAcknowledgementRate };
}

export async function getManagerNotificationThresholdLastChange(managerUserId: number, clinicId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [membership] = await db.select({ clinicId: clinicMemberships.clinicId }).from(clinicMemberships).where(and(eq(clinicMemberships.userId, managerUserId), eq(clinicMemberships.clinicId, clinicId), eq(clinicMemberships.status, "ACTIVE"), eq(clinicMemberships.memberRole, "MANAGER"))).limit(1);
  if (!membership) return undefined;
  const [event] = await db.select({ summary: auditEvents.summary, createdAt: auditEvents.createdAt, actorName: users.name }).from(auditEvents).innerJoin(users, eq(users.id, auditEvents.actorUserId)).where(and(eq(auditEvents.clinicId, clinicId), eq(auditEvents.eventType, "NOTIFICATION_THRESHOLD_CHANGED"))).orderBy(desc(auditEvents.createdAt)).limit(1);
  return event ?? null;
}

export async function listManagerNotificationThresholdChanges(managerUserId: number, clinicId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [membership] = await db.select({ clinicId: clinicMemberships.clinicId }).from(clinicMemberships).where(and(eq(clinicMemberships.userId, managerUserId), eq(clinicMemberships.clinicId, clinicId), eq(clinicMemberships.status, "ACTIVE"), eq(clinicMemberships.memberRole, "MANAGER"))).limit(1);
  if (!membership) return undefined;
  return db.select({ summary: auditEvents.summary, createdAt: auditEvents.createdAt, actorName: users.name }).from(auditEvents).innerJoin(users, eq(users.id, auditEvents.actorUserId)).where(and(eq(auditEvents.clinicId, clinicId), eq(auditEvents.eventType, "NOTIFICATION_THRESHOLD_CHANGED"))).orderBy(desc(auditEvents.createdAt)).limit(5);
}

export async function exportManagerNotificationResponseCsv(managerUserId: number, days = 30, clinicId?: number) {
  const report = await getManagerNotificationResponseReport(managerUserId, days, clinicId);
  const rows = [["الفترة بالأيام", "إجمالي الإشعارات", "غير المؤكدة", "المؤكدة", "نسبة التأكيد", "متوسط الاستجابة بالدقائق"], [days, report.total, report.pending, report.acknowledged, `${report.acknowledgementRate}%`, report.averageResponseMinutes ?? ""]];
  const clinicSuffix = clinicId ? `-clinic-${clinicId}` : "";
  return { filename: `medicare-notification-response${clinicSuffix}-${days}d-${new Date().toISOString().slice(0, 10)}.csv`, content: `\ufeff${rows.map(row => row.map(csvCell).join(",")).join("\r\n")}` };
}

export async function exportManagerNotificationResponseTrendCsv(managerUserId: number, days = 30, clinicId?: number) {
  const trend = await getManagerNotificationResponseTrend(managerUserId, days, clinicId);
  const rows = [["التاريخ UTC", "إجمالي الإشعارات", "غير المؤكدة", "المؤكدة", "نسبة التأكيد"], ...trend.map(point => [point.date, point.total, point.pending, point.acknowledged, `${point.acknowledgementRate}%`])];
  const clinicSuffix = clinicId ? `-clinic-${clinicId}` : "";
  return { filename: `medicare-notification-response-trend${clinicSuffix}-${days}d-${new Date().toISOString().slice(0, 10)}.csv`, content: `\ufeff${rows.map(row => row.map(csvCell).join(",")).join("\r\n")}` };
}

export async function acknowledgeManagerNotification(managerUserId: number, notificationId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const notification = (await db.select().from(managerNotifications).where(and(eq(managerNotifications.id, notificationId), eq(managerNotifications.managerUserId, managerUserId))).limit(1))[0];
  if (!notification) return undefined;
  const membership = (await db.select().from(clinicMemberships).where(and(eq(clinicMemberships.userId, managerUserId), eq(clinicMemberships.clinicId, notification.clinicId), eq(clinicMemberships.memberRole, "MANAGER"), eq(clinicMemberships.status, "ACTIVE"))).limit(1))[0];
  if (!membership) return undefined;
  if (notification.acknowledgedAt) return notification;
  const acknowledgedAt = new Date();
  await db.transaction(async tx => {
    await tx.update(managerNotifications).set({ acknowledgedAt }).where(eq(managerNotifications.id, notificationId));
    await tx.insert(auditEvents).values({
      clinicId: notification.clinicId,
      actorUserId: managerUserId,
      eventType: "NOTIFICATION_ACKNOWLEDGED",
      resourceType: "MANAGER_NOTIFICATION",
      resourceId: notification.id,
      summary: "تم تأكيد الاطلاع على إشعار زيارة متأخرة.",
    });
  });
  return { ...notification, acknowledgedAt };
}

export async function acknowledgeAllManagerNotifications(managerUserId: number) {
  const db = await getDb();
  if (!db) return { acknowledgedCount: 0 };
  const managerMemberships = await db.select().from(clinicMemberships).where(and(eq(clinicMemberships.userId, managerUserId), eq(clinicMemberships.status, "ACTIVE"), eq(clinicMemberships.memberRole, "MANAGER")));
  const clinicIds = managerMemberships.map(membership => membership.clinicId);
  if (clinicIds.length === 0) return undefined;
  const notifications = await db.select().from(managerNotifications).where(and(eq(managerNotifications.managerUserId, managerUserId), inArray(managerNotifications.clinicId, clinicIds)));
  const pendingNotificationIds = notifications.filter(notification => !notification.acknowledgedAt).map(notification => notification.id);
  let acknowledgedCount = 0;
  for (const notificationId of pendingNotificationIds) {
    const acknowledged = await acknowledgeManagerNotification(managerUserId, notificationId);
    if (acknowledged?.acknowledgedAt) acknowledgedCount += 1;
  }
  return { acknowledgedCount };
}

export async function listAssignedVisitsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const memberships = await db.select().from(clinicMemberships).where(and(eq(clinicMemberships.userId, userId), eq(clinicMemberships.status, "ACTIVE"), inArray(clinicMemberships.memberRole, ["CLINICIAN", "NURSE"])));
  const clinicIds = memberships.filter(membership => isEligibleAssigneeMembership(membership, membership.clinicId)).map(membership => membership.clinicId);
  if (clinicIds.length === 0) return [];
  const assignments = await db.select().from(visitAssignments).where(eq(visitAssignments.assigneeUserId, userId)).orderBy(desc(visitAssignments.createdAt));
  const visitIds = assignments.map(assignment => assignment.visitId);
  if (visitIds.length === 0) return [];
  return db.select().from(visits).where(and(inArray(visits.id, visitIds), inArray(visits.clinicId, clinicIds))).orderBy(desc(visits.scheduledStart));
}

export async function listStaffForOperationalClinics(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const managerMemberships = await db.select().from(clinicMemberships).where(and(eq(clinicMemberships.userId, userId), eq(clinicMemberships.status, "ACTIVE"), eq(clinicMemberships.memberRole, "MANAGER")));
  const clinicIds = managerMemberships.map(membership => membership.clinicId);
  if (clinicIds.length === 0) return [];
  const staffMemberships = (await db.select().from(clinicMemberships).where(and(inArray(clinicMemberships.clinicId, clinicIds), eq(clinicMemberships.status, "ACTIVE"), inArray(clinicMemberships.memberRole, ["CLINICIAN", "NURSE"])))).filter(membership => isEligibleAssigneeMembership(membership, membership.clinicId));
  const staffUserIds = Array.from(new Set(staffMemberships.map(membership => membership.userId)));
  if (staffUserIds.length === 0) return [];
  const staffUsers = await db.select().from(users).where(inArray(users.id, staffUserIds));
  return staffMemberships.flatMap(membership => {
    const staffUser = staffUsers.find(candidate => candidate.id === membership.userId);
    return staffUser ? [{ userId: staffUser.id, displayName: staffUser.name ?? "عضو فريق", clinicId: membership.clinicId, clinicName: membership.clinicName, memberRole: membership.memberRole }] : [];
  });
}

export async function listManagedStaffMemberships(managerUserId: number) {
  const db = await getDb();
  if (!db) return [];
  const managerMemberships = await db.select().from(clinicMemberships).where(and(eq(clinicMemberships.userId, managerUserId), eq(clinicMemberships.status, "ACTIVE"), eq(clinicMemberships.memberRole, "MANAGER")));
  const clinicIds = managerMemberships.map(membership => membership.clinicId);
  if (clinicIds.length === 0) return [];
  const staffMemberships = await db.select().from(clinicMemberships).where(and(inArray(clinicMemberships.clinicId, clinicIds), inArray(clinicMemberships.memberRole, ["CLINICIAN", "NURSE"])));
  const staffUserIds = Array.from(new Set(staffMemberships.map(membership => membership.userId)));
  if (staffUserIds.length === 0) return [];
  const staffUsers = await db.select().from(users).where(inArray(users.id, staffUserIds));
  return staffMemberships.flatMap(membership => {
    const staffUser = staffUsers.find(candidate => candidate.id === membership.userId);
    return staffUser ? [{ membershipId: membership.id, userId: staffUser.id, displayName: staffUser.name ?? "عضو فريق", clinicId: membership.clinicId, clinicName: membership.clinicName, memberRole: membership.memberRole, status: membership.status }] : [];
  });
}

export async function listStaffAvailabilityWindows(managerUserId: number, clinicId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [managerMembership] = await db.select().from(clinicMemberships).where(and(eq(clinicMemberships.userId, managerUserId), eq(clinicMemberships.clinicId, clinicId), eq(clinicMemberships.memberRole, "MANAGER"), eq(clinicMemberships.status, "ACTIVE"))).limit(1);
  if (!managerMembership) return undefined;
  const windows = await db.select().from(staffAvailabilityWindows).where(eq(staffAvailabilityWindows.clinicId, clinicId)).orderBy(desc(staffAvailabilityWindows.startAt)).limit(30);
  const staffUserIds = Array.from(new Set(windows.map(window => window.staffUserId)));
  const staffUsers = staffUserIds.length ? await db.select().from(users).where(inArray(users.id, staffUserIds)) : [];
  return windows.filter(window => !window.cancelledAt).map(window => ({ ...window, clinicName: managerMembership.clinicName, staffName: staffUsers.find(user => user.id === window.staffUserId)?.name ?? "عضو فريق" }));
}

export async function createStaffAvailabilityWindow(input: { managerUserId: number; clinicId: number; staffUserId: number; startAt: Date; endAt: Date }) {
  if (input.startAt >= input.endAt) return undefined;
  const db = await getDb();
  if (!db) return undefined;
  const [managerMembership] = await db.select().from(clinicMemberships).where(and(eq(clinicMemberships.userId, input.managerUserId), eq(clinicMemberships.clinicId, input.clinicId), eq(clinicMemberships.memberRole, "MANAGER"), eq(clinicMemberships.status, "ACTIVE"))).limit(1);
  if (!managerMembership) return undefined;
  const [staffMembership] = await db.select().from(clinicMemberships).where(and(eq(clinicMemberships.userId, input.staffUserId), eq(clinicMemberships.clinicId, input.clinicId), eq(clinicMemberships.status, "ACTIVE"), inArray(clinicMemberships.memberRole, ["CLINICIAN", "NURSE"]))).limit(1);
  if (!staffMembership) return undefined;
  const existingWindows = await db.select().from(staffAvailabilityWindows).where(and(eq(staffAvailabilityWindows.clinicId, input.clinicId), eq(staffAvailabilityWindows.staffUserId, input.staffUserId))).orderBy(desc(staffAvailabilityWindows.startAt)).limit(30);
  if (hasAvailabilityOverlap(existingWindows, input.startAt, input.endAt)) return "OVERLAP" as const;
  const createdAt = new Date();
  await db.insert(staffAvailabilityWindows).values({ clinicId: input.clinicId, staffUserId: input.staffUserId, startAt: input.startAt, endAt: input.endAt, createdByUserId: input.managerUserId, createdAt });
  return { clinicId: input.clinicId, clinicName: managerMembership.clinicName, staffUserId: input.staffUserId, startAt: input.startAt, endAt: input.endAt, createdAt };
}

export async function updateStaffAvailabilityWindow(input: { managerUserId: number; availabilityWindowId: number; startAt: Date; endAt: Date }) {
  if (input.startAt >= input.endAt) return undefined;
  const db = await getDb();
  if (!db) return undefined;
  const [window] = await db.select().from(staffAvailabilityWindows).where(eq(staffAvailabilityWindows.id, input.availabilityWindowId)).limit(1);
  if (!window || window.cancelledAt) return undefined;
  const [managerMembership] = await db.select().from(clinicMemberships).where(and(eq(clinicMemberships.userId, input.managerUserId), eq(clinicMemberships.clinicId, window.clinicId), eq(clinicMemberships.memberRole, "MANAGER"), eq(clinicMemberships.status, "ACTIVE"))).limit(1);
  if (!managerMembership) return undefined;
  const existingWindows = await db.select().from(staffAvailabilityWindows).where(and(eq(staffAvailabilityWindows.clinicId, window.clinicId), eq(staffAvailabilityWindows.staffUserId, window.staffUserId))).orderBy(desc(staffAvailabilityWindows.startAt)).limit(30);
  if (hasAvailabilityOverlap(existingWindows, input.startAt, input.endAt, window.id)) return "OVERLAP" as const;
  await db.update(staffAvailabilityWindows).set({ startAt: input.startAt, endAt: input.endAt }).where(eq(staffAvailabilityWindows.id, window.id));
  return { ...window, startAt: input.startAt, endAt: input.endAt, clinicName: managerMembership.clinicName };
}

export async function cancelStaffAvailabilityWindow(managerUserId: number, availabilityWindowId: number) {
  const db = await getDb();
  if (!db) return false;
  const [window] = await db.select().from(staffAvailabilityWindows).where(eq(staffAvailabilityWindows.id, availabilityWindowId)).limit(1);
  if (!window || window.cancelledAt) return false;
  const [managerMembership] = await db.select().from(clinicMemberships).where(and(eq(clinicMemberships.userId, managerUserId), eq(clinicMemberships.clinicId, window.clinicId), eq(clinicMemberships.memberRole, "MANAGER"), eq(clinicMemberships.status, "ACTIVE"))).limit(1);
  if (!managerMembership) return false;
  await db.update(staffAvailabilityWindows).set({ cancelledAt: new Date() }).where(eq(staffAvailabilityWindows.id, availabilityWindowId));
  return true;
}

export async function getVisitAssignmentAvailability(managerUserId: number, visitId: number, staffUserId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [visit] = await db.select().from(visits).where(eq(visits.id, visitId)).limit(1);
  if (!visit) return undefined;
  const [managerMembership] = await db.select().from(clinicMemberships).where(and(eq(clinicMemberships.userId, managerUserId), eq(clinicMemberships.clinicId, visit.clinicId), eq(clinicMemberships.memberRole, "MANAGER"), eq(clinicMemberships.status, "ACTIVE"))).limit(1);
  if (!managerMembership) return undefined;
  const [staffMembership] = await db.select().from(clinicMemberships).where(and(eq(clinicMemberships.userId, staffUserId), eq(clinicMemberships.clinicId, visit.clinicId), eq(clinicMemberships.status, "ACTIVE"), inArray(clinicMemberships.memberRole, ["CLINICIAN", "NURSE"]))).limit(1);
  if (!staffMembership) return undefined;
  const [durationSetting] = await db.select({ durationMinutes: clinicVisitDurationSettings.durationMinutes, transitionBufferMinutes: clinicVisitDurationSettings.transitionBufferMinutes }).from(clinicVisitDurationSettings).where(eq(clinicVisitDurationSettings.clinicId, visit.clinicId)).limit(1);
  const durationMinutes = (durationSetting?.durationMinutes ?? DEFAULT_VISIT_DURATION_MINUTES) as VisitDurationMinutes;
  const transitionBufferMinutes = (durationSetting?.transitionBufferMinutes ?? 0) as TransitionBufferMinutes;
  const windows = await db.select().from(staffAvailabilityWindows).where(and(eq(staffAvailabilityWindows.clinicId, visit.clinicId), eq(staffAvailabilityWindows.staffUserId, staffUserId))).orderBy(desc(staffAvailabilityWindows.startAt)).limit(30);
  const activeWindows = windows.filter(window => !window.cancelledAt);
  const visitStart = new Date(visit.scheduledStart);
  const visitEnd = new Date(visitStart.getTime() + durationMinutes * 60 * 1000);
  const isCovered = activeWindows.some(window => new Date(window.startAt) <= visitStart && new Date(window.endAt) >= visitEnd);
  const assignedVisits = await db.select({ id: visits.id, reference: visits.reference, scheduledStart: visits.scheduledStart, state: visits.state }).from(visitAssignments).innerJoin(visits, eq(visitAssignments.visitId, visits.id)).where(and(eq(visitAssignments.assigneeUserId, staffUserId), eq(visits.clinicId, visit.clinicId)));
  const conflictingVisit = findConflictingAssignedVisit(assignedVisits, visit.id, visitStart, durationMinutes, transitionBufferMinutes);
  const availabilityStatus = activeWindows.length === 0 ? "NOT_CONFIGURED" as const : isCovered ? "AVAILABLE" as const : "OUTSIDE_AVAILABILITY" as const;
  return { visitId: visit.id, clinicId: visit.clinicId, visitReference: visit.reference, scheduledStart: visitStart, durationMinutes, transitionBufferMinutes, status: conflictingVisit ? "ASSIGNMENT_CONFLICT" as const : availabilityStatus, conflictingVisitReference: conflictingVisit?.reference };
}

export async function getClinicVisitDurationSetting(managerUserId: number, clinicId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [membership] = await db.select({ clinicId: clinicMemberships.clinicId, clinicName: clinicMemberships.clinicName }).from(clinicMemberships).where(and(eq(clinicMemberships.userId, managerUserId), eq(clinicMemberships.clinicId, clinicId), eq(clinicMemberships.status, "ACTIVE"), eq(clinicMemberships.memberRole, "MANAGER"))).limit(1);
  if (!membership) return undefined;
  const [setting] = await db.select({ durationMinutes: clinicVisitDurationSettings.durationMinutes, transitionBufferMinutes: clinicVisitDurationSettings.transitionBufferMinutes }).from(clinicVisitDurationSettings).where(eq(clinicVisitDurationSettings.clinicId, clinicId)).limit(1);
  return { clinicId, clinicName: membership.clinicName, durationMinutes: (setting?.durationMinutes ?? DEFAULT_VISIT_DURATION_MINUTES) as VisitDurationMinutes, transitionBufferMinutes: (setting?.transitionBufferMinutes ?? 0) as TransitionBufferMinutes };
}

export async function setClinicVisitDurationSetting(managerUserId: number, clinicId: number, durationMinutes: VisitDurationMinutes, transitionBufferMinutes?: TransitionBufferMinutes) {
  if (!visitDurationOptions.includes(durationMinutes) || (transitionBufferMinutes !== undefined && !transitionBufferOptions.includes(transitionBufferMinutes))) return undefined;
  const setting = await getClinicVisitDurationSetting(managerUserId, clinicId);
  if (!setting) return undefined;
  const db = await getDb();
  if (!db) return undefined;
  const nextTransitionBufferMinutes = transitionBufferMinutes ?? setting.transitionBufferMinutes;
  await db.insert(clinicVisitDurationSettings).values({ clinicId, durationMinutes, transitionBufferMinutes: nextTransitionBufferMinutes, updatedByUserId: managerUserId }).onDuplicateKeyUpdate({ set: { durationMinutes, transitionBufferMinutes: nextTransitionBufferMinutes, updatedByUserId: managerUserId, updatedAt: new Date() } });
  return { ...setting, durationMinutes, transitionBufferMinutes: nextTransitionBufferMinutes };
}

export async function listAuditEventsForManager(managerUserId: number, filter: { eventType?: (typeof auditEventTypes)[number]; from?: Date; to?: Date; query?: string; clinicId?: number } = {}) {
  const db = await getDb();
  if (!db) return [];
  const managerMemberships = await db.select().from(clinicMemberships).where(and(eq(clinicMemberships.userId, managerUserId), eq(clinicMemberships.status, "ACTIVE"), eq(clinicMemberships.memberRole, "MANAGER")));
  const clinicIds = filter.clinicId ? managerMemberships.filter(membership => membership.clinicId === filter.clinicId).map(membership => membership.clinicId) : managerMemberships.map(membership => membership.clinicId);
  if (clinicIds.length === 0) return [];
  const events = await db.select().from(auditEvents).where(and(
    inArray(auditEvents.clinicId, clinicIds),
    filter.eventType ? eq(auditEvents.eventType, filter.eventType) : undefined,
    filter.from ? gte(auditEvents.createdAt, filter.from) : undefined,
    filter.to ? lte(auditEvents.createdAt, filter.to) : undefined,
    filter.query ? like(auditEvents.summary, `%${filter.query}%`) : undefined,
  )).orderBy(desc(auditEvents.createdAt)).limit(50);
  const actorIds = Array.from(new Set(events.map(event => event.actorUserId)));
  if (actorIds.length === 0) return [];
  const actorUsers = await db.select().from(users).where(inArray(users.id, actorIds));
  return events.map(event => ({ ...event, clinicName: managerMemberships.find(membership => membership.clinicId === event.clinicId)?.clinicName ?? "عيادة تشغيلية", actorName: actorUsers.find(user => user.id === event.actorUserId)?.name ?? "مستخدم تشغيلي" }));
}

export async function getAuditEventDetailsForManager(managerUserId: number, eventId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const managerMemberships = await db.select().from(clinicMemberships).where(and(eq(clinicMemberships.userId, managerUserId), eq(clinicMemberships.status, "ACTIVE"), eq(clinicMemberships.memberRole, "MANAGER")));
  const clinicIds = managerMemberships.map(membership => membership.clinicId);
  if (clinicIds.length === 0) return undefined;
  const [event] = await db.select().from(auditEvents).where(and(eq(auditEvents.id, eventId), inArray(auditEvents.clinicId, clinicIds))).limit(1);
  if (!event) return undefined;
  const [actor] = await db.select({ name: users.name }).from(users).where(eq(users.id, event.actorUserId)).limit(1);
  return { id: event.id, clinicId: event.clinicId, clinicName: managerMemberships.find(membership => membership.clinicId === event.clinicId)?.clinicName ?? "عيادة تشغيلية", eventType: event.eventType, resourceType: event.resourceType, resourceId: event.resourceId, summary: event.summary, createdAt: event.createdAt, actorName: actor?.name ?? "مستخدم تشغيلي" };
}

function csvCell(value: unknown) {
  const normalized = String(value ?? "").replace(/[\r\n]+/g, " ");
  const safe = /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function exportAuditEventsCsvForManager(managerUserId: number, filter: { eventType?: (typeof auditEventTypes)[number]; from?: Date; to?: Date; query?: string; clinicId?: number } = {}) {
  const events = await listAuditEventsForManager(managerUserId, filter);
  const rows = [
    ["التاريخ UTC", "اسم العيادة", "نوع الحدث", "الملخص التشغيلي", "المنفذ", "نوع المورد", "معرف المورد"],
    ...events.map(event => [new Date(event.createdAt).toISOString(), event.clinicName, event.eventType, event.summary, event.actorName, event.resourceType, event.resourceId]),
  ];
  return {
    filename: `medicare-audit-${new Date().toISOString().slice(0, 10)}.csv`,
    content: `\ufeff${rows.map(row => row.map(csvCell).join(",")).join("\r\n")}`,
  };
}

export async function setManagedStaffMembershipStatus(input: { managerUserId: number; membershipId: number; status: "ACTIVE" | "INACTIVE" }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const staffMembership = (await db.select().from(clinicMemberships).where(eq(clinicMemberships.id, input.membershipId)).limit(1))[0];
  if (!staffMembership || (staffMembership.memberRole !== "CLINICIAN" && staffMembership.memberRole !== "NURSE")) return undefined;
  const managerMembership = (await db.select().from(clinicMemberships).where(and(eq(clinicMemberships.userId, input.managerUserId), eq(clinicMemberships.clinicId, staffMembership.clinicId), eq(clinicMemberships.memberRole, "MANAGER"), eq(clinicMemberships.status, "ACTIVE"))).limit(1))[0];
  if (!managerMembership) return undefined;
  await db.update(clinicMemberships).set({ status: input.status }).where(eq(clinicMemberships.id, input.membershipId));
  await db.insert(auditEvents).values({ clinicId: staffMembership.clinicId, actorUserId: input.managerUserId, eventType: "STAFF_MEMBERSHIP_STATUS_CHANGED", resourceType: "MEMBERSHIP", resourceId: input.membershipId, summary: input.status === "ACTIVE" ? "تم تفعيل عضوية فريق." : "تم تعليق عضوية فريق." });
  return (await db.select().from(clinicMemberships).where(eq(clinicMemberships.id, input.membershipId)).limit(1))[0];
}

export async function ensureDemoClinicianForOperationalClinic(managerUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const managerMembership = (await db.select().from(clinicMemberships).where(and(eq(clinicMemberships.userId, managerUserId), eq(clinicMemberships.status, "ACTIVE"), eq(clinicMemberships.memberRole, "MANAGER"))).limit(1))[0];
  if (!managerMembership) return undefined;
  const demoOpenId = `demo-clinician-clinic-${managerMembership.clinicId}`;
  let demoUser = await getUserByOpenId(demoOpenId);
  if (!demoUser) {
    await db.insert(users).values({ openId: demoOpenId, name: "ممارس تجريبي آمن", loginMethod: "demo", role: "user" });
    demoUser = await getUserByOpenId(demoOpenId);
  }
  if (!demoUser) return undefined;
  const existingMembership = (await db.select().from(clinicMemberships).where(and(eq(clinicMemberships.userId, demoUser.id), eq(clinicMemberships.clinicId, managerMembership.clinicId))).limit(1))[0];
  if (!existingMembership) {
    await db.insert(clinicMemberships).values({ clinicId: managerMembership.clinicId, clinicName: managerMembership.clinicName, userId: demoUser.id, memberRole: "CLINICIAN", status: "ACTIVE" });
  }
  return { userId: demoUser.id, displayName: demoUser.name ?? "ممارس تجريبي آمن", clinicId: managerMembership.clinicId, clinicName: managerMembership.clinicName, memberRole: "CLINICIAN" as const };
}

export async function getVisitForPatient(visitId: number, patientId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(visits).where(eq(visits.id, visitId)).limit(1);
  const visit = result[0];
  return visit?.patientId === patientId ? visit : undefined;
}

export async function getVisitById(visitId: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(visits).where(eq(visits.id, visitId)).limit(1))[0];
}

export async function createVisitForPatient(input: {
  patientId: number;
  clinicName: string;
  serviceName: string;
  districtLabel: string;
  scheduledStart: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const reference = `V-${Date.now().toString().slice(-8)}`;
  await db.insert(visits).values({ ...input, reference, state: "REQUESTED" });
  const result = await db.select().from(visits).where(eq(visits.reference, reference)).limit(1);
  const visit = result[0];
  if (visit) {
    await db.insert(patientNotifications).values({ userId: visit.patientId, visitId: visit.id, ...buildVisitCreatedNotification() });
  }
  return visit;
}

export async function assignVisit(input: { visitId: number; assignedByUserId: number; assigneeLabel: string; assigneeUserId?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const current = (await db.select().from(visits).where(eq(visits.id, input.visitId)).limit(1))[0];
  if (!current || current.state !== "REQUESTED") return undefined;
  const membership = (await db.select().from(clinicMemberships).where(and(eq(clinicMemberships.userId, input.assignedByUserId), eq(clinicMemberships.clinicId, current.clinicId), eq(clinicMemberships.status, "ACTIVE"))).limit(1))[0];
  if (!membership) return undefined;
  if (input.assigneeUserId) {
    const assigneeMembership = (await db.select().from(clinicMemberships).where(and(eq(clinicMemberships.userId, input.assigneeUserId), eq(clinicMemberships.clinicId, current.clinicId), eq(clinicMemberships.status, "ACTIVE"), inArray(clinicMemberships.memberRole, ["CLINICIAN", "NURSE"]))).limit(1))[0];
    if (!isEligibleAssigneeMembership(assigneeMembership, current.clinicId)) return undefined;
    const availability = await getVisitAssignmentAvailability(input.assignedByUserId, current.id, input.assigneeUserId);
    if (!availability || availability.status === "OUTSIDE_AVAILABILITY" || availability.status === "ASSIGNMENT_CONFLICT") return undefined;
  }
  await db.transaction(async tx => {
    await tx.insert(visitAssignments).values({ visitId: input.visitId, assignedByUserId: input.assignedByUserId, assigneeLabel: input.assigneeLabel, assigneeUserId: input.assigneeUserId });
    await tx.update(visits).set({ state: "ASSIGNED" }).where(eq(visits.id, input.visitId));
    await tx.insert(visitStatusHistory).values({ visitId: input.visitId, fromState: current.state, toState: "ASSIGNED", changedByUserId: input.assignedByUserId });
    await tx.insert(auditEvents).values({ clinicId: current.clinicId, actorUserId: input.assignedByUserId, eventType: "VISIT_ASSIGNED", resourceType: "VISIT", resourceId: input.visitId, summary: `تم تكليف الزيارة ${current.reference} بعضو فريق.` });
  });
  return (await db.select().from(visits).where(eq(visits.id, input.visitId)).limit(1))[0];
}

export async function transitionVisit(input: { visitId: number; changedByUserId: number; nextState: VisitState }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const current = (await db.select().from(visits).where(eq(visits.id, input.visitId)).limit(1))[0];
  if (!current) return undefined;
  const membership = (await db.select().from(clinicMemberships).where(and(eq(clinicMemberships.userId, input.changedByUserId), eq(clinicMemberships.clinicId, current.clinicId), eq(clinicMemberships.status, "ACTIVE"))).limit(1))[0];
  if (!membership) return undefined;
  if (membership.memberRole !== "MANAGER") {
    const assignment = (await db.select().from(visitAssignments).where(and(eq(visitAssignments.visitId, input.visitId), eq(visitAssignments.assigneeUserId, input.changedByUserId))).limit(1))[0];
    if (!assignment) return undefined;
  }
  await db.transaction(async tx => {
    await tx.update(visits).set({ state: input.nextState }).where(eq(visits.id, input.visitId));
    await tx.insert(visitStatusHistory).values({ visitId: input.visitId, fromState: current.state, toState: input.nextState, changedByUserId: input.changedByUserId });
    await tx.insert(auditEvents).values({ clinicId: current.clinicId, actorUserId: input.changedByUserId, eventType: "VISIT_STATE_CHANGED", resourceType: "VISIT", resourceId: input.visitId, summary: `تم تحديث حالة الزيارة ${current.reference} إلى ${input.nextState}.` });
    if (input.nextState === "COMPLETED") {
      await tx.insert(invoices).values({ visitId: input.visitId, invoiceNo: `INV-${current.reference.replace("V-", "")}`, totalHalalas: 27000, status: "DUE" });
    }
  });
  const visit = (await db.select().from(visits).where(eq(visits.id, input.visitId)).limit(1))[0];
  if (visit) {
    await db.insert(patientNotifications).values({ userId: visit.patientId, visitId: visit.id, ...buildVisitStatusNotification(visit.state) });
  }
  return visit;
}

export async function getReportForPatient(visitId: number, patientId: number) {
  const visit = await getVisitForPatient(visitId, patientId);
  if (!visit || visit.state !== "COMPLETED") return undefined;
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(medicalReports).where(eq(medicalReports.visitId, visitId)).limit(1))[0];
}

export async function getInvoiceForPatient(visitId: number, patientId: number) {
  const visit = await getVisitForPatient(visitId, patientId);
  if (!visit || visit.state !== "COMPLETED") return undefined;
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(invoices).where(eq(invoices.visitId, visitId)).limit(1))[0];
}

export async function finalizeReport(input: { visitId: number; authoredByUserId: number; summary: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const visit = await getVisitById(input.visitId);
  if (!visit || visit.state !== "COMPLETED") return undefined;
  const membership = (await db.select().from(clinicMemberships).where(and(eq(clinicMemberships.userId, input.authoredByUserId), eq(clinicMemberships.clinicId, visit.clinicId), eq(clinicMemberships.memberRole, "CLINICIAN"), eq(clinicMemberships.status, "ACTIVE"))).limit(1))[0];
  if (!membership) return undefined;
  const assignment = (await db.select().from(visitAssignments).where(and(eq(visitAssignments.visitId, input.visitId), eq(visitAssignments.assigneeUserId, input.authoredByUserId))).limit(1))[0];
  if (!assignment) return undefined;
  const existing = (await db.select().from(medicalReports).where(eq(medicalReports.visitId, input.visitId)).limit(1))[0];
  if (existing) return undefined;
  await db.insert(medicalReports).values({ visitId: input.visitId, authoredByUserId: input.authoredByUserId, summary: input.summary });
  return (await db.select().from(medicalReports).where(eq(medicalReports.visitId, input.visitId)).limit(1))[0];
}

export async function recordDemoPayment(visitId: number, patientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const visit = await getVisitForPatient(visitId, patientId);
  if (!visit || visit.state !== "COMPLETED") return undefined;
  const invoice = (await db.select().from(invoices).where(eq(invoices.visitId, visitId)).limit(1))[0];
  if (!invoice || invoice.status !== "DUE") return undefined;
  const providerReference = `DEMO-${invoice.invoiceNo}-${Date.now().toString().slice(-6)}`;
  await db.transaction(async tx => {
    await tx.insert(payments).values({ invoiceId: invoice.id, providerReference, amountHalalas: invoice.totalHalalas });
    await tx.update(invoices).set({ status: "PAID" }).where(eq(invoices.id, invoice.id));
  });
  return (await db.select().from(invoices).where(eq(invoices.id, invoice.id)).limit(1))[0];
}

export async function listActiveMembershipsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clinicMemberships).where(and(eq(clinicMemberships.userId, userId), eq(clinicMemberships.status, "ACTIVE")));
}
