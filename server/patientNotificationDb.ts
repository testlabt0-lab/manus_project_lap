import { and, desc, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { patientNotifications } from "../drizzle/schema";
import type { PatientNotificationKind } from "./patientNotificationPolicy";

type Db = ReturnType<typeof drizzle>;

export async function createPatientNotification(db: Db, input: { userId: number; visitId?: number; kind: PatientNotificationKind; title: string; body: string }) {
  await db.insert(patientNotifications).values(input);
}

export async function listPatientNotifications(db: Db, userId: number) {
  return db.select().from(patientNotifications).where(eq(patientNotifications.userId, userId)).orderBy(desc(patientNotifications.createdAt)).limit(100);
}

export async function markPatientNotificationRead(db: Db, input: { userId: number; notificationId: number; now?: Date }) {
  const now = input.now ?? new Date();
  const result = await db.update(patientNotifications).set({ readAt: now }).where(and(
    eq(patientNotifications.id, input.notificationId),
    eq(patientNotifications.userId, input.userId),
    isNull(patientNotifications.readAt),
  ));
  const affectedRows = Number((result as unknown as [{ affectedRows?: number }])[0]?.affectedRows ?? 0);
  return affectedRows === 1;
}
