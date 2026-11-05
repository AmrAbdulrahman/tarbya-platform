import { Injectable } from '@nestjs/common';
import { PrismaService, type Prisma } from '@tarbya/db';
import type { ChangeDto, ChangePageDto } from './audit.dto';
import { requestContext } from '../../common/request-context';

export const AUDIT_ACTIONS = [
  'user.create',
  'user.update',
  'user.deactivate',
  'user.reactivate',
  'user.manager.set',
  'user.moderator.set',
  'settings.update',
  'mentorship.start',
  'mentorship.end',
  'user.impersonate.start',
  'user.impersonate.stop',
  'group.create',
  'group.update',
  'group.admin.set',
  'group.member.add',
  'group.member.remove',
  'group.role.set',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditEntry {
  actorId: string;
  action: AuditAction;
  entity: 'User' | 'Setting' | 'Mentorship' | 'Group';
  entityId: string;
  /** Changed fields as { field: [before, after] }. */
  diff?: Record<string, [unknown, unknown]>;
}

type Tx = Pick<PrismaService, 'auditLog'> | Prisma.TransactionClient;

/** Writes the audit log for sensitive changes (BR-ADM-4). Pass the transaction so both commit together. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * While the super admin impersonates someone, their changes are recorded as
   * theirs, on behalf of the impersonated user.
   */
  async record(entry: AuditEntry, tx: Tx = this.prisma): Promise<void> {
    const by = requestContext.getStore()?.impersonatorId;
    const onBehalf = by && by !== entry.actorId;
    await tx.auditLog.create({
      data: {
        ...entry,
        ...(onBehalf && { actorId: by, onBehalfOfId: entry.actorId }),
        diff: (entry.diff ?? undefined) as Prisma.InputJsonValue,
      },
    });
  }
}

const ref = { select: { id: true, name: true } } as const;

/** A member's change log for admins: changes to them and to their mentorships. */
@Injectable()
export class ChangeLogService {
  constructor(private readonly prisma: PrismaService) {}

  async forUser(
    userId: string,
    before?: string,
    limit = 20,
  ): Promise<ChangePageDto> {
    const mentorships = await this.prisma.mentorship.findMany({
      where: { OR: [{ mentorId: userId }, { menteeId: userId }] },
      select: { id: true },
    });
    const rows = await this.prisma.auditLog.findMany({
      where: {
        OR: [
          { entity: 'User', entityId: userId },
          {
            entity: 'Mentorship',
            entityId: { in: mentorships.map((m) => m.id) },
          },
        ],
        ...(before && { createdAt: { lt: new Date(before) } }),
      },
      select: {
        id: true,
        action: true,
        entity: true,
        diff: true,
        createdAt: true,
        actor: ref,
        onBehalfOf: ref,
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    const items: ChangeDto[] = page.map((r) => ({
      id: r.id,
      action: r.action as AuditAction,
      actor: r.actor,
      onBehalfOf: r.onBehalfOf,
      fields: r.diff && typeof r.diff === 'object' ? Object.keys(r.diff) : [],
      createdAt: r.createdAt.toISOString(),
    }));
    return {
      items,
      nextCursor:
        rows.length > limit
          ? page[page.length - 1].createdAt.toISOString()
          : null,
    };
  }
}

/** { field: [before, after] } for the fields of `next` that differ from `before`. */
export function diffOf<T extends object>(
  before: T,
  next: Partial<T>,
): Record<string, [unknown, unknown]> {
  const out: Record<string, [unknown, unknown]> = {};
  for (const key of Object.keys(next) as (keyof T)[]) {
    // JSON has no undefined: a missing value is recorded as null.
    const was = before[key] ?? null;
    if (next[key] !== undefined && next[key] !== was) {
      out[key as string] = [was, next[key]];
    }
  }
  return out;
}
