import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, type VisitState, users, visitAssignments, visits, visitStatusHistory } from "../drizzle/schema";
import { ENV } from './_core/env';

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

export async function listOperationalVisits() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(visits).orderBy(desc(visits.scheduledStart));
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
  return result[0];
}

export async function assignVisit(input: { visitId: number; assignedByUserId: number; assigneeLabel: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const current = (await db.select().from(visits).where(eq(visits.id, input.visitId)).limit(1))[0];
  if (!current || current.state !== "REQUESTED") return undefined;
  await db.transaction(async tx => {
    await tx.insert(visitAssignments).values({ visitId: input.visitId, assignedByUserId: input.assignedByUserId, assigneeLabel: input.assigneeLabel });
    await tx.update(visits).set({ state: "ASSIGNED" }).where(eq(visits.id, input.visitId));
    await tx.insert(visitStatusHistory).values({ visitId: input.visitId, fromState: current.state, toState: "ASSIGNED", changedByUserId: input.assignedByUserId });
  });
  return (await db.select().from(visits).where(eq(visits.id, input.visitId)).limit(1))[0];
}

export async function transitionVisit(input: { visitId: number; changedByUserId: number; nextState: VisitState }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const current = (await db.select().from(visits).where(eq(visits.id, input.visitId)).limit(1))[0];
  if (!current) return undefined;
  await db.transaction(async tx => {
    await tx.update(visits).set({ state: input.nextState }).where(eq(visits.id, input.visitId));
    await tx.insert(visitStatusHistory).values({ visitId: input.visitId, fromState: current.state, toState: input.nextState, changedByUserId: input.changedByUserId });
  });
  return (await db.select().from(visits).where(eq(visits.id, input.visitId)).limit(1))[0];
}
