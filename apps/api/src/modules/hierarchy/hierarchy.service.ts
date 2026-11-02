import { Injectable } from '@nestjs/common';
import type { Prisma } from '@tarbya/db';

/** The management tree (BR-MGR-1, BR-MGR-2): `User.managerId` read with recursive queries. */
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
}
