import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { auditEventTypes, visitStates } from "../drizzle/schema";
import { acknowledgeAllManagerNotifications, acknowledgeManagerNotification, assignVisit, cancelStaffAvailabilityWindow, captureManagerNotificationAnalyticsSnapshot, createStaffAvailabilityWindow, createVisitForPatient, ensureDemoClinicianForOperationalClinic, exportAuditEventsCsvForManager, exportManagerNotificationResponseCsv, exportManagerNotificationResponseTrendCsv, finalizeReport, getAuditEventDetailsForManager, getClinicVisitDurationSetting, getDb, getInvoiceForPatient, getManagerNotificationResponseComparison, getManagerNotificationResponsePreference, getManagerNotificationResponseReport, getManagerNotificationResponseThresholdAlert, getManagerNotificationResponseTrend, getManagerNotificationThresholdLastChange, getReportForPatient, getVisitAssignmentAvailability, getVisitById, getVisitForPatient, listActiveMembershipsForUser, listAssignedVisitsForUser, listAuditEventsForManager, listManagedNotificationClinics, listManagedStaffMemberships, listManagerNotifications, listManagerNotificationAnalyticsSnapshots, listManagerNotificationThresholdChanges, listOperationalVisits, listStaffAvailabilityWindows, listStaffForOperationalClinics, listVisitsForPatient, listWeeklyAssignmentsForManager, recordDemoPayment, setClinicVisitDurationSetting, setManagedStaffMembershipStatus, setManagerNotificationResponsePreference, transitionVisit, updateStaffAvailabilityWindow } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { isAllowedVisitTransition } from "./visitPolicy";
import { listStaffWeeklyCapacitySettings, setStaffWeeklyCapacitySetting } from "./db";
import { listStaffServiceSkills, setStaffServiceSkills, setVisitRequiredStaffSkill } from "./db";
import { listStaffServiceZones, setStaffServiceZones, setVisitServiceZone } from "./db";
import { getOverdueVisitAlerts } from "./alertPolicy";
import { createPatientNotification, listPatientNotifications, markPatientNotificationRead } from "./patientNotificationDb";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  visits: router({
    listMine: protectedProcedure.query(({ ctx }) => listVisitsForPatient(ctx.user.id)),
    listOperations: adminProcedure.query(({ ctx }) => listOperationalVisits(ctx.user.id)),
    listAssignedToMe: protectedProcedure.query(({ ctx }) => listAssignedVisitsForUser(ctx.user.id)),
    setRequiredStaffSkill: adminProcedure.input(z.object({ visitId: z.number().int().positive(), requiredStaffSkill: z.enum(["GENERAL_HOME_VISIT", "MOBILITY_ASSISTANCE", "MEDICATION_SUPPORT", "SAMPLE_COLLECTION"]) })).mutation(async ({ ctx, input }) => {
      const result = await setVisitRequiredStaffSkill(ctx.user.id, input.visitId, input.requiredStaffSkill);
      if (!result) throw new TRPCError({ code: "FORBIDDEN", message: "Visit skill requirement cannot be updated" });
      return result;
    }),
    setServiceZone: adminProcedure.input(z.object({ visitId: z.number().int().positive(), serviceZone: z.enum(["CENTRAL", "NORTH", "SOUTH", "EAST", "WEST"]) })).mutation(async ({ ctx, input }) => {
      const result = await setVisitServiceZone(ctx.user.id, input.visitId, input.serviceZone);
      if (!result) throw new TRPCError({ code: "FORBIDDEN", message: "Visit service zone cannot be updated" });
      return result;
    }),
    getMine: protectedProcedure.input(z.object({ visitId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const visit = await getVisitForPatient(input.visitId, ctx.user.id);
      if (!visit) throw new TRPCError({ code: "NOT_FOUND" });
      return visit;
    }),
    create: protectedProcedure.input(z.object({
      clinicName: z.string().trim().min(2).max(160),
      serviceName: z.string().trim().min(2).max(160),
      districtLabel: z.string().trim().min(2).max(180),
      scheduledStart: z.date(),
    })).mutation(async ({ ctx, input }) => {
      const visit = await createVisitForPatient({ ...input, patientId: ctx.user.id });
      if (!visit) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return visit;
    }),
    assign: adminProcedure.input(z.object({ visitId: z.number().int().positive(), assigneeLabel: z.string().trim().min(2).max(120), assigneeUserId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => {
      if (input.assigneeUserId) {
        const availability = await getVisitAssignmentAvailability(ctx.user.id, input.visitId, input.assigneeUserId);
        if (!availability) throw new TRPCError({ code: "FORBIDDEN", message: "Assignment availability cannot be checked for this clinic" });
        if (availability.status === "SKILL_MISMATCH") throw new TRPCError({ code: "CONFLICT", message: "The selected staff member does not match the visit skill requirement" });
        if (availability.status === "ZONE_MISMATCH") throw new TRPCError({ code: "CONFLICT", message: "The selected staff member does not cover the visit service zone" });
        if (availability.status === "OUTSIDE_AVAILABILITY") throw new TRPCError({ code: "CONFLICT", message: "The selected staff member is not available for this visit time" });
        if (availability.status === "ASSIGNMENT_CONFLICT") throw new TRPCError({ code: "CONFLICT", message: "The selected staff member already has an overlapping visit assignment" });
      }
      const visit = await assignVisit({ ...input, assignedByUserId: ctx.user.id });
      if (!visit) throw new TRPCError({ code: "CONFLICT", message: "Visit cannot be assigned in its current state" });
      return visit;
    }),
    assignmentAvailability: adminProcedure.input(z.object({ visitId: z.number().int().positive(), staffUserId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const availability = await getVisitAssignmentAvailability(ctx.user.id, input.visitId, input.staffUserId);
      if (!availability) throw new TRPCError({ code: "FORBIDDEN", message: "Assignment availability cannot be checked for this clinic" });
      return availability;
    }),
    transition: protectedProcedure.input(z.object({ visitId: z.number().int().positive(), nextState: z.enum(visitStates) })).mutation(async ({ ctx, input }) => {
      const current = await getVisitById(input.visitId);
      if (!current) throw new TRPCError({ code: "NOT_FOUND" });
      if (!isAllowedVisitTransition(current.state, input.nextState)) throw new TRPCError({ code: "CONFLICT", message: "Invalid visit state transition" });
      const visit = await transitionVisit({ ...input, changedByUserId: ctx.user.id });
      if (!visit) throw new TRPCError({ code: "FORBIDDEN", message: "Visit transition is not authorized for this user" });
      return visit;
    }),
  }),
  memberships: router({
    mine: protectedProcedure.query(({ ctx }) => listActiveMembershipsForUser(ctx.user.id)),
    listStaffForOperations: adminProcedure.query(({ ctx }) => listStaffForOperationalClinics(ctx.user.id)),
    listManagedStaff: adminProcedure.query(({ ctx }) => listManagedStaffMemberships(ctx.user.id)),
    setStaffStatus: adminProcedure.input(z.object({ membershipId: z.number().int().positive(), status: z.enum(["ACTIVE", "INACTIVE"]) })).mutation(async ({ ctx, input }) => {
      const membership = await setManagedStaffMembershipStatus({ ...input, managerUserId: ctx.user.id });
      if (!membership) throw new TRPCError({ code: "FORBIDDEN", message: "Staff membership cannot be managed by this user" });
      return membership;
    }),
    ensureDemoClinician: adminProcedure.mutation(async ({ ctx }) => {
      const staffMember = await ensureDemoClinicianForOperationalClinic(ctx.user.id);
      if (!staffMember) throw new TRPCError({ code: "FORBIDDEN", message: "No active manager clinic membership" });
      return staffMember;
    }),
  }),
  staffAvailability: router({
    list: adminProcedure.input(z.object({ clinicId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const windows = await listStaffAvailabilityWindows(ctx.user.id, input.clinicId);
      if (!windows) throw new TRPCError({ code: "FORBIDDEN", message: "Staff availability cannot be read for this clinic" });
      return windows;
    }),
    create: adminProcedure.input(z.object({ clinicId: z.number().int().positive(), staffUserId: z.number().int().positive(), startAt: z.date(), endAt: z.date() })).mutation(async ({ ctx, input }) => {
      if (input.startAt >= input.endAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Availability start must precede end" });
      const window = await createStaffAvailabilityWindow({ ...input, managerUserId: ctx.user.id });
      if (window === "OVERLAP") throw new TRPCError({ code: "CONFLICT", message: "Availability window overlaps an existing window" });
      if (!window) throw new TRPCError({ code: "FORBIDDEN", message: "Staff availability cannot be created for this clinic or staff member" });
      return window;
    }),
    update: adminProcedure.input(z.object({ availabilityWindowId: z.number().int().positive(), startAt: z.date(), endAt: z.date() })).mutation(async ({ ctx, input }) => {
      if (input.startAt >= input.endAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Availability start must precede end" });
      const window = await updateStaffAvailabilityWindow({ ...input, managerUserId: ctx.user.id });
      if (window === "OVERLAP") throw new TRPCError({ code: "CONFLICT", message: "Availability window overlaps an existing window" });
      if (!window) throw new TRPCError({ code: "FORBIDDEN", message: "Staff availability cannot be updated by this user" });
      return window;
    }),
    cancel: adminProcedure.input(z.object({ availabilityWindowId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      if (!await cancelStaffAvailabilityWindow(ctx.user.id, input.availabilityWindowId)) throw new TRPCError({ code: "FORBIDDEN", message: "Staff availability cannot be cancelled by this user" });
      return { success: true };
    }),
  }),
  visitDuration: router({
    get: adminProcedure.input(z.object({ clinicId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const setting = await getClinicVisitDurationSetting(ctx.user.id, input.clinicId);
      if (!setting) throw new TRPCError({ code: "FORBIDDEN", message: "Visit duration cannot be read for this clinic" });
      return setting;
    }),
    set: adminProcedure.input(z.object({ clinicId: z.number().int().positive(), durationMinutes: z.union([z.literal(30), z.literal(45), z.literal(60), z.literal(90), z.literal(120)]), transitionBufferMinutes: z.union([z.literal(0), z.literal(15), z.literal(30), z.literal(45), z.literal(60)]).optional() })).mutation(async ({ ctx, input }) => {
      const setting = await setClinicVisitDurationSetting(ctx.user.id, input.clinicId, input.durationMinutes, input.transitionBufferMinutes);
      if (!setting) throw new TRPCError({ code: "FORBIDDEN", message: "Visit duration cannot be updated for this clinic" });
      return setting;
    }),
  }),
  assignments: router({
    weekly: adminProcedure.input(z.object({ clinicId: z.number().int().positive(), weekStart: z.date(), states: z.array(z.enum(["REQUESTED", "ASSIGNED", "CONFIRMED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS", "COMPLETED", "CANCELLED"])).max(8).optional() })).query(async ({ ctx, input }) => {
      const result = input.states ? await listWeeklyAssignmentsForManager(ctx.user.id, input.clinicId, input.weekStart, input.states) : await listWeeklyAssignmentsForManager(ctx.user.id, input.clinicId, input.weekStart);
      if (!result) throw new TRPCError({ code: "FORBIDDEN", message: "Weekly assignments cannot be read for this clinic" });
      return result;
    }),
  }),
  staffCapacity: router({
    list: adminProcedure.input(z.object({ clinicId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const settings = await listStaffWeeklyCapacitySettings(ctx.user.id, input.clinicId);
      if (!settings) throw new TRPCError({ code: "FORBIDDEN", message: "Weekly capacity cannot be read for this clinic" });
      return settings;
    }),
    set: adminProcedure.input(z.object({ clinicId: z.number().int().positive(), staffUserId: z.number().int().positive(), targetActiveAssignments: z.number().int().min(1).max(20) })).mutation(async ({ ctx, input }) => {
      const setting = await setStaffWeeklyCapacitySetting(ctx.user.id, input.clinicId, input.staffUserId, input.targetActiveAssignments);
      if (!setting) throw new TRPCError({ code: "FORBIDDEN", message: "Weekly capacity cannot be updated for this clinic or staff member" });
      return setting;
    }),
  }),
  staffSkills: router({
    list: adminProcedure.input(z.object({ clinicId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const skills = await listStaffServiceSkills(ctx.user.id, input.clinicId);
      if (!skills) throw new TRPCError({ code: "FORBIDDEN", message: "Staff skills cannot be read for this clinic" });
      return skills;
    }),
    set: adminProcedure.input(z.object({ clinicId: z.number().int().positive(), staffUserId: z.number().int().positive(), skillCodes: z.array(z.enum(["GENERAL_HOME_VISIT", "MOBILITY_ASSISTANCE", "MEDICATION_SUPPORT", "SAMPLE_COLLECTION"])).max(4) })).mutation(async ({ ctx, input }) => {
      const skills = await setStaffServiceSkills(ctx.user.id, input.clinicId, input.staffUserId, input.skillCodes);
      if (!skills) throw new TRPCError({ code: "FORBIDDEN", message: "Staff skills cannot be updated for this clinic or staff member" });
      return skills;
    }),
  }),
  staffServiceZones: router({
    list: adminProcedure.input(z.object({ clinicId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const zones = await listStaffServiceZones(ctx.user.id, input.clinicId);
      if (!zones) throw new TRPCError({ code: "FORBIDDEN", message: "Staff service zones cannot be read for this clinic" });
      return zones;
    }),
    set: adminProcedure.input(z.object({ clinicId: z.number().int().positive(), staffUserId: z.number().int().positive(), zoneCodes: z.array(z.enum(["CENTRAL", "NORTH", "SOUTH", "EAST", "WEST"])).max(5) })).mutation(async ({ ctx, input }) => {
      const zones = await setStaffServiceZones(ctx.user.id, input.clinicId, input.staffUserId, input.zoneCodes);
      if (!zones) throw new TRPCError({ code: "FORBIDDEN", message: "Staff service zones cannot be updated for this clinic or staff member" });
      return zones;
    }),
  }),
  audit: router({
    getOperation: adminProcedure.input(z.object({ eventId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const event = await getAuditEventDetailsForManager(ctx.user.id, input.eventId);
      if (!event) throw new TRPCError({ code: "NOT_FOUND" });
      return event;
    }),
    listOperations: adminProcedure.input(z.object({ eventType: z.enum(auditEventTypes).optional(), from: z.date().optional(), to: z.date().optional(), query: z.string().trim().min(2).max(80).optional(), clinicId: z.number().int().positive().optional() }).optional()).query(({ ctx, input }) => {
      if (input?.from && input.to && input.from > input.to) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid audit date range" });
      return listAuditEventsForManager(ctx.user.id, input);
    }),
    exportCsv: adminProcedure.input(z.object({ eventType: z.enum(auditEventTypes).optional(), from: z.date().optional(), to: z.date().optional(), query: z.string().trim().min(2).max(80).optional(), clinicId: z.number().int().positive().optional() }).optional()).query(({ ctx, input }) => {
      if (input?.from && input.to && input.from > input.to) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid audit date range" });
      return exportAuditEventsCsvForManager(ctx.user.id, input);
    }),
  }),
  alerts: router({
    listOverdue: adminProcedure.input(z.object({ graceMinutes: z.number().int().min(0).max(1440).default(30) }).optional()).query(async ({ ctx, input }) => {
      const visits = await listOperationalVisits(ctx.user.id);
      return getOverdueVisitAlerts(visits, input?.graceMinutes ?? 30);
    }),
  }),
  notifications: router({
    listMine: adminProcedure.query(({ ctx }) => listManagerNotifications(ctx.user.id)),
    managedClinics: adminProcedure.query(({ ctx }) => listManagedNotificationClinics(ctx.user.id)),
    analyticsSnapshotHistory: adminProcedure.input(z.object({ clinicId: z.number().int().positive(), limit: z.number().int().min(1).max(10).default(5) })).query(async ({ ctx, input }) => {
      const snapshots = await listManagerNotificationAnalyticsSnapshots(ctx.user.id, input.clinicId, input.limit);
      if (!snapshots) throw new TRPCError({ code: "FORBIDDEN", message: "Analytics snapshots cannot be read for this clinic" });
      return snapshots;
    }),
    captureAnalyticsSnapshot: adminProcedure.input(z.object({ clinicId: z.number().int().positive(), days: z.union([z.literal(7), z.literal(30), z.literal(90)]) })).mutation(async ({ ctx, input }) => {
      const snapshot = await captureManagerNotificationAnalyticsSnapshot(ctx.user.id, input.clinicId, input.days);
      if (!snapshot) throw new TRPCError({ code: "FORBIDDEN", message: "Analytics snapshot cannot be captured for this clinic" });
      return snapshot;
    }),
    responseReport: adminProcedure.input(z.object({ days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30), clinicId: z.number().int().positive().optional() }).optional()).query(({ ctx, input }) => getManagerNotificationResponseReport(ctx.user.id, input?.days ?? 30, input?.clinicId)),
    responseComparison: adminProcedure.input(z.object({ days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30), clinicId: z.number().int().positive().optional() })).query(({ ctx, input }) => getManagerNotificationResponseComparison(ctx.user.id, input.days, input.clinicId)),
    responseTrend: adminProcedure.input(z.object({ days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30), clinicId: z.number().int().positive().optional() })).query(({ ctx, input }) => getManagerNotificationResponseTrend(ctx.user.id, input.days, input.clinicId)),
    responseThresholdAlert: adminProcedure.input(z.object({ days: z.union([z.literal(7), z.literal(30), z.literal(90)]), minimumAcknowledgementRate: z.number().int().min(0).max(100), clinicId: z.number().int().positive().optional() })).query(({ ctx, input }) => getManagerNotificationResponseThresholdAlert(ctx.user.id, input.days, input.minimumAcknowledgementRate, input.clinicId)),
    getResponsePreference: adminProcedure.input(z.object({ clinicId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const preference = await getManagerNotificationResponsePreference(ctx.user.id, input.clinicId);
      if (!preference) throw new TRPCError({ code: "FORBIDDEN", message: "Clinic preference cannot be read by this user" });
      return preference;
    }),
    setResponsePreference: adminProcedure.input(z.object({ clinicId: z.number().int().positive(), minimumAcknowledgementRate: z.union([z.literal(50), z.literal(60), z.literal(70), z.literal(80), z.literal(90)]) })).mutation(async ({ ctx, input }) => {
      const preference = await setManagerNotificationResponsePreference(ctx.user.id, input.clinicId, input.minimumAcknowledgementRate);
      if (!preference) throw new TRPCError({ code: "FORBIDDEN", message: "Clinic preference cannot be updated by this user" });
      return preference;
    }),
    thresholdLastChange: adminProcedure.input(z.object({ clinicId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const event = await getManagerNotificationThresholdLastChange(ctx.user.id, input.clinicId);
      if (event === undefined) throw new TRPCError({ code: "FORBIDDEN", message: "Clinic threshold audit cannot be read by this user" });
      return event;
    }),
    thresholdChangeHistory: adminProcedure.input(z.object({ clinicId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const events = await listManagerNotificationThresholdChanges(ctx.user.id, input.clinicId);
      if (events === undefined) throw new TRPCError({ code: "FORBIDDEN", message: "Clinic threshold history cannot be read by this user" });
      return events;
    }),
    exportResponseCsv: adminProcedure.input(z.object({ days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30), clinicId: z.number().int().positive().optional() })).query(({ ctx, input }) => exportManagerNotificationResponseCsv(ctx.user.id, input.days, input.clinicId)),
    exportResponseTrendCsv: adminProcedure.input(z.object({ days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30), clinicId: z.number().int().positive().optional() })).query(({ ctx, input }) => exportManagerNotificationResponseTrendCsv(ctx.user.id, input.days, input.clinicId)),
    acknowledge: adminProcedure.input(z.object({ notificationId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const notification = await acknowledgeManagerNotification(ctx.user.id, input.notificationId);
      if (!notification) throw new TRPCError({ code: "FORBIDDEN", message: "Notification cannot be acknowledged by this user" });
      return notification;
    }),
    acknowledgeAll: adminProcedure.mutation(async ({ ctx }) => {
      const result = await acknowledgeAllManagerNotifications(ctx.user.id);
      if (!result) throw new TRPCError({ code: "FORBIDDEN", message: "Notifications cannot be acknowledged by this user" });
      return result;
    }),
  }),
  patientNotifications: router({
    listMine: protectedProcedure.query(async ({ ctx }) => {
      const database = await getDb();
      return database ? listPatientNotifications(database, ctx.user.id) : [];
    }),
    markRead: protectedProcedure.input(z.object({ notificationId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const updated = await markPatientNotificationRead(database, { userId: ctx.user.id, notificationId: input.notificationId });
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return { success: true };
    }),
  }),
  outputs: router({
    finalizeReport: protectedProcedure.input(z.object({ visitId: z.number().int().positive(), summary: z.string().trim().min(10).max(4000) })).mutation(async ({ ctx, input }) => {
      const report = await finalizeReport({ ...input, authoredByUserId: ctx.user.id });
      if (!report) throw new TRPCError({ code: "FORBIDDEN", message: "Report cannot be finalized for this visit" });
      return report;
    }),
    reportMine: protectedProcedure.input(z.object({ visitId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const report = await getReportForPatient(input.visitId, ctx.user.id);
      if (!report) throw new TRPCError({ code: "NOT_FOUND" });
      return report;
    }),
    invoiceMine: protectedProcedure.input(z.object({ visitId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const invoice = await getInvoiceForPatient(input.visitId, ctx.user.id);
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });
      return invoice;
    }),
    recordDemoPayment: protectedProcedure.input(z.object({ visitId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const invoice = await recordDemoPayment(input.visitId, ctx.user.id);
      if (!invoice) throw new TRPCError({ code: "CONFLICT", message: "Invoice cannot be paid in its current state" });
      return invoice;
    }),
  }),

});

export type AppRouter = typeof appRouter;
