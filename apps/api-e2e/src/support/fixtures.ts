import { hash } from 'argon2';
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { Client } from 'pg';

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

/** A fresh user with a unique email, so reruns don't trip per-email limits. */
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

export async function createMentorship(mentorId: string, menteeId: string) {
  const c = await db();
  await c.query(
    `INSERT INTO "Mentorship" (id, "mentorId", "menteeId", "updatedAt") VALUES ($1, $2, $3, now())`,
    [randomUUID(), mentorId, menteeId],
  );
}

/** The newest sign-in code Mailpit received for this address. */
export async function latestCode(email: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}&limit=1`,
    );
    const { messages } = (await res.json()) as {
      messages: { Subject: string }[];
    };
    const match = messages[0]?.Subject.match(/\b(\d{6})\b/);
    if (match) return match[1];
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
