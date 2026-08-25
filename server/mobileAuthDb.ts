import { and, eq, gt, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { mobileAuthSessions, mobileRefreshTokens, users } from "../drizzle/schema";

type Db = ReturnType<typeof drizzle>;

export type MobileAuthSessionInput = {
  nonce: string;
  appRedirectUri: string;
  appState: string;
  codeChallenge: string;
  expiresAt: Date;
};

export async function createMobileAuthSession(db: Db, input: MobileAuthSessionInput) {
  await db.insert(mobileAuthSessions).values(input);
}

export async function getPendingMobileAuthSession(db: Db, nonce: string, now = new Date()) {
  return (await db.select().from(mobileAuthSessions).where(and(
    eq(mobileAuthSessions.nonce, nonce),
    isNull(mobileAuthSessions.authorizedAt),
    isNull(mobileAuthSessions.consumedAt),
    gt(mobileAuthSessions.expiresAt, now),
  )).limit(1))[0];
}

export async function authorizeMobileAuthSession(db: Db, input: { nonce: string; userId: number; authorizationCodeHash: string; now?: Date }) {
  const now = input.now ?? new Date();
  await db.update(mobileAuthSessions).set({
    userId: input.userId,
    authorizationCodeHash: input.authorizationCodeHash,
    authorizedAt: now,
  }).where(and(
    eq(mobileAuthSessions.nonce, input.nonce),
    isNull(mobileAuthSessions.authorizedAt),
    isNull(mobileAuthSessions.consumedAt),
    gt(mobileAuthSessions.expiresAt, now),
  ));

  return (await db.select().from(mobileAuthSessions).where(and(
    eq(mobileAuthSessions.nonce, input.nonce),
    eq(mobileAuthSessions.authorizationCodeHash, input.authorizationCodeHash),
  )).limit(1))[0];
}

export async function getAuthorizedMobileAuthSession(db: Db, authorizationCodeHash: string, now = new Date()) {
  return (await db.select().from(mobileAuthSessions).where(and(
    eq(mobileAuthSessions.authorizationCodeHash, authorizationCodeHash),
    isNull(mobileAuthSessions.consumedAt),
    gt(mobileAuthSessions.expiresAt, now),
  )).limit(1))[0];
}

export async function consumeMobileAuthSession(db: Db, authorizationCodeHash: string, now = new Date()) {
  const result = await db.update(mobileAuthSessions).set({ consumedAt: now }).where(and(
    eq(mobileAuthSessions.authorizationCodeHash, authorizationCodeHash),
    isNull(mobileAuthSessions.consumedAt),
    gt(mobileAuthSessions.expiresAt, now),
  ));
  const affectedRows = Number((result as unknown as [{ affectedRows?: number }])[0]?.affectedRows ?? 0);
  return affectedRows === 1;
}

export async function getMobileAuthUser(db: Db, userId: number) {
  return (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
}

export async function createMobileRefreshToken(db: Db, input: { tokenHash: string; userId: number; clientId: string; expiresAt: Date }) {
  await db.insert(mobileRefreshTokens).values(input);
}

export async function getActiveMobileRefreshToken(db: Db, input: { tokenHash: string; clientId: string; now?: Date }) {
  const now = input.now ?? new Date();
  return (await db.select().from(mobileRefreshTokens).where(and(
    eq(mobileRefreshTokens.tokenHash, input.tokenHash),
    eq(mobileRefreshTokens.clientId, input.clientId),
    isNull(mobileRefreshTokens.revokedAt),
    isNull(mobileRefreshTokens.rotatedAt),
    gt(mobileRefreshTokens.expiresAt, now),
  )).limit(1))[0];
}

export async function rotateMobileRefreshToken(db: Db, input: { tokenHash: string; clientId: string; now?: Date }) {
  const now = input.now ?? new Date();
  const result = await db.update(mobileRefreshTokens).set({ rotatedAt: now }).where(and(
    eq(mobileRefreshTokens.tokenHash, input.tokenHash),
    eq(mobileRefreshTokens.clientId, input.clientId),
    isNull(mobileRefreshTokens.revokedAt),
    isNull(mobileRefreshTokens.rotatedAt),
    gt(mobileRefreshTokens.expiresAt, now),
  ));
  const affectedRows = Number((result as unknown as [{ affectedRows?: number }])[0]?.affectedRows ?? 0);
  return affectedRows === 1;
}
