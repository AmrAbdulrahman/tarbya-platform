import { Injectable } from '@nestjs/common';
import { PrismaService, type Prisma } from '@tarbya/db';

export type AuditAction =
  | 'user.create'
  | 'user.update'
  | 'user.deactivate'
  | 'user.reactivate'
  | 'user.manager.set'
  | 'user.moderator.set'
  | 'settings.update';

export interface AuditEntry {
  actorId: string;
  action: AuditAction;
  entity: 'User' | 'Setting';
  entityId: string;
  /** Changed fields as { field: [before, after] }. */
  diff?: Record<string, [unknown, unknown]>;
}

type Tx = Pick<PrismaService, 'auditLog'> | Prisma.TransactionClient;

/** Writes the audit log for sensitive changes (BR-ADM-4). Pass the transaction so both commit together. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry, tx: Tx = this.prisma): Promise<void> {
    await tx.auditLog.create({
      data: {
        ...entry,
        diff: (entry.diff ?? undefined) as Prisma.InputJsonValue,
      },
    });
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
