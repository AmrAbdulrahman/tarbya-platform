import { Injectable } from '@nestjs/common';
import type { Prisma } from '@tarbya/db';

/**
 * The two trees, read with recursive queries: management (`User.managerId`,
 * BR-MGR-1/2) and mentoring (active mentorships, BR-MEN-3).
 */
@Injectable()
export class HierarchyService {
  /** True when `candidateId` is `userId` or anywhere below them, i.e. making them the manager would close a loop. */
  async isInSubtree(
    tx: Prisma.TransactionClient,
    userId: string,
    candidateId: string,
  ): Promise<boolean> {
    const rows = await tx.$queryRaw<{ found: number }[]>`
      WITH RECURSIVE subtree AS (
        SELECT id FROM "User" WHERE id = ${userId}::uuid
        UNION
        SELECT u.id FROM "User" u JOIN subtree s ON u."managerId" = s.id
      )
      SELECT 1 AS found FROM subtree WHERE id = ${candidateId}::uuid LIMIT 1`;
    return rows.length > 0;
  }

  /** True when `candidateId` mentors `userId`, directly or further up their mentoring chain. */
  async isMentorAbove(
    tx: Prisma.TransactionClient,
    userId: string,
    candidateId: string,
  ): Promise<boolean> {
    const rows = await tx.$queryRaw<{ found: number }[]>`
      WITH RECURSIVE chain AS (
        SELECT "mentorId" AS id FROM "Mentorship"
        WHERE "menteeId" = ${userId}::uuid AND "endedAt" IS NULL
        UNION
        SELECT m."mentorId" FROM "Mentorship" m
        JOIN chain c ON m."menteeId" = c.id AND m."endedAt" IS NULL
      )
      SELECT 1 AS found FROM chain WHERE id = ${candidateId}::uuid LIMIT 1`;
    return rows.length > 0;
  }

  /** True when `candidateId` is anywhere above `userId` in the management line (BR-GRP-4). */
  async isManagerAbove(
    tx: Prisma.TransactionClient,
    userId: string,
    candidateId: string,
  ): Promise<boolean> {
    const rows = await tx.$queryRaw<{ found: number }[]>`
      WITH RECURSIVE chain AS (
        SELECT "managerId" AS id FROM "User" WHERE id = ${userId}::uuid
        UNION
        SELECT u."managerId" FROM "User" u JOIN chain c ON u.id = c.id
      )
      SELECT 1 AS found FROM chain WHERE id = ${candidateId}::uuid LIMIT 1`;
    return rows.length > 0;
  }

  /** Groups whose admin sits anywhere below `managerId` (BR-GRP-4): seen, not joined. */
  async groupsBelow(
    tx: Prisma.TransactionClient,
    managerId: string,
  ): Promise<string[]> {
    const rows = await tx.$queryRaw<{ groupId: string }[]>`
      WITH RECURSIVE below AS (
        SELECT id FROM "User" WHERE "managerId" = ${managerId}::uuid
        UNION
        SELECT u.id FROM "User" u JOIN below b ON u."managerId" = b.id
      )
      SELECT m."groupId" FROM "GroupMembership" m
      JOIN below b ON b.id = m."userId"
      WHERE m.role = 'ADMIN'`;
    return rows.map((r) => r.groupId);
  }
}
