import { Injectable } from '@nestjs/common';
import { PrismaService } from '@tarbya/db';

/** Last contact per active mentorship (BR-FU-5). */
@Injectable()
export class ContactService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The latest done follow-up in the mentorship, or done activity the mentor
   * created with the mentee taking part, since the mentorship started.
   */
  async lastContacts(mentorId: string): Promise<Map<string, Date | null>> {
    const rows = await this.prisma.$queryRaw<
      { id: string; last: Date | null }[]
    >`
      SELECT ms.id, GREATEST(
        (SELECT max(i."startsAt") FROM "Interaction" i
          WHERE i."mentorshipId" = ms.id AND i."startsAt" <= now()),
        (SELECT max(i."startsAt") FROM "Interaction" i
          JOIN "InteractionParticipant" p ON p."interactionId" = i.id
          WHERE i.kind = 'ACTIVITY' AND i."createdById" = ms."mentorId"
            AND p."userId" = ms."menteeId"
            AND i."startsAt" <= now() AND i."startsAt" >= ms."startedAt")
      ) AS last
      FROM "Mentorship" ms
      WHERE ms."mentorId" = ${mentorId}::uuid AND ms."endedAt" IS NULL`;
    return new Map(rows.map((r) => [r.id, r.last]));
  }
}
