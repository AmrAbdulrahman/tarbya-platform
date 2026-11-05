import { hash } from 'argon2';
import { sign } from 'jsonwebtoken';
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { Session } from './session';

config({ path: resolve(__dirname, '../../../../.env'), quiet: true });

export const MAILPIT_URL =
  process.env['MAILPIT_URL'] ?? 'http://localhost:8025';

let client: Client | undefined;

async function db(): Promise<Client> {
  if (!client) {
    client = new Client({ connectionString: process.env['DATABASE_URL'] });
    await client.connect();
  }
  return client;
}

export async function closeDb() {
  await client?.end();
  client = undefined;
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

/**
 * A fresh user with a unique email, so reruns don't trip per-email limits.
 * Every e2e email ends in @tarbya.test so the teardown can remove them.
 */
export async function createUser(
  opts: {
    moderator?: boolean;
    deactivated?: boolean;
    password?: string | null;
  } = {},
): Promise<TestUser> {
  const c = await db();
  const id = randomUUID();
  const email = `e2e-${id.slice(0, 8)}@tarbya.test`;
  const password = opts.password ?? 'correct horse battery';
  await c.query(
    `INSERT INTO "User" (id, name, email, "isModerator", "deactivatedAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, now())`,
    [
      id,
      `E2E ${id.slice(0, 4)}`,
      email,
      !!opts.moderator,
      opts.deactivated ? new Date() : null,
    ],
  );
  if (opts.password !== null) {
    await c.query(
      `INSERT INTO "PasswordCredential" ("userId", hash, "updatedAt") VALUES ($1, $2, now())`,
      [id, await hash(password)],
    );
  }
  return { id, email, password };
}

export async function createMentorship(
  mentorId: string,
  menteeId: string,
  startedAt: Date = new Date(),
) {
  const c = await db();
  await c.query(
    `INSERT INTO "Mentorship" (id, "mentorId", "menteeId", "startedAt", "updatedAt") VALUES ($1, $2, $3, $4, now())`,
    [randomUUID(), mentorId, menteeId, startedAt],
  );
}

/** The newest code Mailpit received for this address (sign-in or contact change). */
export async function latestCode(
  email: string,
  after?: string,
): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}&limit=1`,
    );
    const { messages } = (await res.json()) as {
      messages: { Subject: string }[];
    };
    const match = messages[0]?.Subject.match(/\b(\d{6})\b/);
    if (match && match[1] !== after) return match[1];
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No sign-in code arrived for ${email}`);
}

export async function messageCount(email: string): Promise<number> {
  const res = await fetch(
    `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
  );
  return ((await res.json()) as { messages_count: number }).messages_count;
}

/**
 * A signed-in session without going through sign-in, so suites don't use up its
 * rate limit: a Session row plus an access token signed like the API's.
 */
export async function signedIn(userId: string): Promise<Session> {
  const c = await db();
  const sessionId = randomUUID();
  await c.query(
    // The user agent marks it for e2e-cleanup.sql (the super admin's sessions outlive the test users).
    `INSERT INTO "Session" (id, "userId", "tokenHash", "expiresAt", "userAgent") VALUES ($1, $2, $3, now() + interval '1 day', 'tarbya-e2e')`,
    [sessionId, userId, randomUUID()],
  );
  const token = sign(
    { sub: userId, sid: sessionId },
    process.env['JWT_SECRET'] as string,
    {
      algorithm: 'HS256',
      expiresIn: 900,
    },
  );
  const session = new Session();
  session.cookies.set('access_token', token);
  return session;
}

/** The super admin from .env (the API creates it on boot). */
export async function superAdminId(): Promise<string> {
  const c = await db();
  const { rows } = await c.query(`SELECT id FROM "User" WHERE email = $1`, [
    (process.env['SUPER_ADMIN_EMAIL'] as string).toLowerCase(),
  ]);
  return rows[0].id;
}

export async function auditActions(entityId: string): Promise<string[]> {
  const c = await db();
  const { rows } = await c.query(
    `SELECT action FROM "AuditLog" WHERE "entityId" = $1 ORDER BY "createdAt"`,
    [entityId],
  );
  return rows.map((r: { action: string }) => r.action);
}

/** Makes the session look older, e.g. to test "sign in again" rules. */
export async function ageSession(userId: string, minutes: number) {
  const c = await db();
  await c.query(
    `UPDATE "Session" SET "createdAt" = now() - ($2 || ' minutes')::interval WHERE "userId" = $1`,
    [userId, String(minutes)],
  );
}

export async function setPassword(userId: string, password: string) {
  const c = await db();
  await c.query(
    `INSERT INTO "PasswordCredential" ("userId", hash, "updatedAt") VALUES ($1, $2, now())
     ON CONFLICT ("userId") DO UPDATE SET hash = excluded.hash`,
    [userId, await hash(password)],
  );
}

/** Backdates when a task was done. */
export async function markTaskDoneDaysAgo(taskId: string, days: number) {
  const c = await db();
  await c.query(
    `UPDATE "Task" SET "doneAt" = now() - ($2 || ' days')::interval WHERE id = $1`,
    [taskId, String(days)],
  );
}

export async function setManager(userId: string, managerId: string | null) {
  const c = await db();
  await c.query(`UPDATE "User" SET "managerId" = $2 WHERE id = $1`, [
    userId,
    managerId,
  ]);
}

/** Notification types a user received, oldest first. */
export async function notificationTypes(userId: string): Promise<string[]> {
  const c = await db();
  const { rows } = await c.query(
    `SELECT type FROM "Notification" WHERE "userId" = $1 ORDER BY "createdAt"`,
    [userId],
  );
  return rows.map((r: { type: string }) => r.type);
}

/** Subjects of the emails Mailpit received for this address, newest first; waits for at least `atLeast`. */
export async function mailSubjects(
  email: string,
  atLeast = 1,
): Promise<string[]> {
  let subjects: string[] = [];
  for (let attempt = 0; attempt < 40; attempt++) {
    const res = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
    );
    const { messages } = (await res.json()) as {
      messages: { Subject: string }[];
    };
    subjects = messages.map((m) => m.Subject);
    if (subjects.length >= atLeast) return subjects;
    await new Promise((r) => setTimeout(r, 250));
  }
  return subjects;
}
