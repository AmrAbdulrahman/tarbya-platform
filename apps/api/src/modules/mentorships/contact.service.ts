import { Injectable } from '@nestjs/common';
import { PrismaService } from '@tarbya/db';

export interface LastContact {
  at: Date;
  kind: 'FOLLOW_UP' | 'ACTIVITY';
}

/** Last contact per active mentorship (BR-FU-5). */
@Injectable()
export class ContactService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The latest done follow-up in the mentorship, or done activity the mentor
   * created with the mentee taking part, since the mentorship started.
   */
  async lastContacts(mentorId: string): Promise<Map<string, LastContact>> {
    const rows = await this.prisma.$queryRaw<
      { id: string; at: Date; kind: LastContact['kind'] }[]
    >`
      SELECT ms.id, last."startsAt" AS at, last.kind::text AS kind
      FROM "Mentorship" ms
      JOIN LATERAL (
        SELECT i."startsAt", i.kind FROM "Interaction" i
        WHERE i."startsAt" <= now() AND (
          i."mentorshipId" = ms.id OR (
            i.kind = 'ACTIVITY' AND i."createdById" = ms."mentorId"
            AND i."startsAt" >= ms."startedAt"
            AND EXISTS (SELECT 1 FROM "InteractionParticipant" p
              WHERE p."interactionId" = i.id AND p."userId" = ms."menteeId")))
        ORDER BY i."startsAt" DESC LIMIT 1
      ) last ON true
      WHERE ms."mentorId" = ${mentorId}::uuid AND ms."endedAt" IS NULL`;
    return new Map(rows.map((r) => [r.id, { at: r.at, kind: r.kind }]));
  }
}
