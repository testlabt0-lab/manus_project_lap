import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { auditEventTypes, visitStates } from "../drizzle/schema";
import { acknowledgeAllManagerNotifications, acknowledgeManagerNotification, assignVisit, createVisitForPatient, ensureDemoClinicianForOperationalClinic, exportAuditEventsCsvForManager, exportManagerNotificationResponseCsv, exportManagerNotificationResponseTrendCsv, finalizeReport, getDb, getInvoiceForPatient, getManagerNotificationResponseComparison, getManagerNotificationResponseReport, getManagerNotificationResponseTrend, getReportForPatient, getVisitById, getVisitForPatient, listActiveMembershipsForUser, listAssignedVisitsForUser, listAuditEventsForManager, listManagedStaffMemberships, listManagerNotifications, listOperationalVisits, listStaffForOperationalClinics, listVisitsForPatient, recordDemoPayment, setManagedStaffMembershipStatus, transitionVisit } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { isAllowedVisitTransition } from "./visitPolicy";
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
      const visit = await assignVisit({ ...input, assignedByUserId: ctx.user.id });
      if (!visit) throw new TRPCError({ code: "CONFLICT", message: "Visit cannot be assigned in its current state" });
      return visit;
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
  audit: router({
    listOperations: adminProcedure.input(z.object({ eventType: z.enum(auditEventTypes).optional(), from: z.date().optional(), to: z.date().optional(), query: z.string().trim().min(2).max(80).optional() }).optional()).query(({ ctx, input }) => {
      if (input?.from && input.to && input.from > input.to) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid audit date range" });
      return listAuditEventsForManager(ctx.user.id, input);
    }),
    exportCsv: adminProcedure.input(z.object({ eventType: z.enum(auditEventTypes).optional(), from: z.date().optional(), to: z.date().optional(), query: z.string().trim().min(2).max(80).optional() }).optional()).query(({ ctx, input }) => {
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
    responseReport: adminProcedure.input(z.object({ days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30) }).optional()).query(({ ctx, input }) => getManagerNotificationResponseReport(ctx.user.id, input?.days ?? 30)),
    responseComparison: adminProcedure.input(z.object({ days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30) })).query(({ ctx, input }) => getManagerNotificationResponseComparison(ctx.user.id, input.days)),
    responseTrend: adminProcedure.input(z.object({ days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30) })).query(({ ctx, input }) => getManagerNotificationResponseTrend(ctx.user.id, input.days)),
    exportResponseCsv: adminProcedure.input(z.object({ days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30) })).query(({ ctx, input }) => exportManagerNotificationResponseCsv(ctx.user.id, input.days)),
    exportResponseTrendCsv: adminProcedure.input(z.object({ days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30) })).query(({ ctx, input }) => exportManagerNotificationResponseTrendCsv(ctx.user.id, input.days)),
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
