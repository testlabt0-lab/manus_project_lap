import { index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const visitStates = ["REQUESTED", "ASSIGNED", "CONFIRMED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;

export const visits = mysqlTable("visits", {
  id: int("id").autoincrement().primaryKey(),
  reference: varchar("reference", { length: 24 }).notNull().unique(),
  patientId: int("patientId").notNull(),
  clinicId: int("clinicId").notNull().default(1),
  clinicName: varchar("clinicName", { length: 160 }).notNull(),
  serviceName: varchar("serviceName", { length: 160 }).notNull(),
  districtLabel: varchar("districtLabel", { length: 180 }).notNull(),
  scheduledStart: timestamp("scheduledStart").notNull(),
  state: mysqlEnum("state", visitStates).default("REQUESTED").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  index("visits_patient_scheduled_idx").on(table.patientId, table.scheduledStart),
  index("visits_state_scheduled_idx").on(table.state, table.scheduledStart),
]);

export const visitStatusHistory = mysqlTable("visit_status_history", {
  id: int("id").autoincrement().primaryKey(),
  visitId: int("visitId").notNull(),
  fromState: mysqlEnum("fromState", visitStates).notNull(),
  toState: mysqlEnum("toState", visitStates).notNull(),
  changedByUserId: int("changedByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  index("visit_history_visit_created_idx").on(table.visitId, table.createdAt),
]);

export const visitAssignments = mysqlTable("visit_assignments", {
  id: int("id").autoincrement().primaryKey(),
  visitId: int("visitId").notNull(),
  assigneeLabel: varchar("assigneeLabel", { length: 120 }).notNull(),
  assignedByUserId: int("assignedByUserId").notNull(),
  status: mysqlEnum("status", ["PENDING", "ACCEPTED"]).default("PENDING").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  index("visit_assignments_visit_idx").on(table.visitId),
]);

export const clinicMemberships = mysqlTable("clinic_memberships", {
  id: int("id").autoincrement().primaryKey(),
  clinicId: int("clinicId").notNull().default(1),
  clinicName: varchar("clinicName", { length: 160 }).notNull(),
  userId: int("userId").notNull(),
  memberRole: mysqlEnum("memberRole", ["MANAGER", "CLINICIAN", "NURSE"]).notNull(),
  status: mysqlEnum("status", ["ACTIVE", "INACTIVE"]).default("ACTIVE").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  index("clinic_memberships_user_status_idx").on(table.userId, table.status),
]);

export const medicalReports = mysqlTable("medical_reports", {
  id: int("id").autoincrement().primaryKey(),
  visitId: int("visitId").notNull().unique(),
  status: mysqlEnum("status", ["FINALIZED"]).default("FINALIZED").notNull(),
  summary: text("summary").notNull(),
  finalizedAt: timestamp("finalizedAt").defaultNow().notNull(),
});

export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  visitId: int("visitId").notNull().unique(),
  invoiceNo: varchar("invoiceNo", { length: 32 }).notNull().unique(),
  totalHalalas: int("totalHalalas").notNull(),
  status: mysqlEnum("status", ["DUE", "PAID"]).default("DUE").notNull(),
  issuedAt: timestamp("issuedAt").defaultNow().notNull(),
});

export type Visit = typeof visits.$inferSelect;
export type VisitState = (typeof visitStates)[number];
