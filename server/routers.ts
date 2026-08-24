import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { visitStates } from "../drizzle/schema";
import { assignVisit, createVisitForPatient, ensureDemoClinicianForOperationalClinic, finalizeReport, getInvoiceForPatient, getReportForPatient, getVisitById, getVisitForPatient, listActiveMembershipsForUser, listAssignedVisitsForUser, listManagedStaffMemberships, listOperationalVisits, listStaffForOperationalClinics, listVisitsForPatient, recordDemoPayment, setManagedStaffMembershipStatus, transitionVisit } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { isAllowedVisitTransition } from "./visitPolicy";

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
