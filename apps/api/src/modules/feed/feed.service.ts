import { Injectable } from '@nestjs/common';
import { PrismaService, type Prisma } from '@tarbya/db';
import { MentoringAccess } from '../mentorships/mentoring-access.service';
import type {
  FeedItemDto,
  FeedPageDto,
  FeedQuery,
  UpcomingDto,
} from './feed.dto';

const ref = { select: { id: true, name: true } } as const;
const typeRef = {
  select: { id: true, nameAr: true, nameEn: true, color: true },
} as const;

const blank = {
  interactionId: null,
  title: null,
  activityType: null,
  planUpdates: 0,
  challenges: 0,
  tasks: 0,
  participants: 0,
  plan: null,
  value: null,
  text: null,
} satisfies Partial<FeedItemDto>;

/** A member's history (US-4.2 timeline, US-5.1 feed) and what's coming up. */
@Injectable()
export class FeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: MentoringAccess,
  ) {}

  /**
   * Done follow-ups and activities the member took part in, their check-ins,
   * and replies to them, newest first. The member, their mentor and admins.
   */
  async feed(viewerId: string, query: FeedQuery): Promise<FeedPageDto> {
    await this.access.assertCanView(viewerId, query.userId);
    const limit = query.limit ?? 20;
    const now = new Date();
    // Upcoming follow-ups aren't history yet, so the first page starts now.
    const before =
      query.before && new Date(query.before) < now
        ? new Date(query.before)
        : now;
    const take = limit + 1;
    const menteePlan = { plan: { menteeId: query.userId } };

    const [interactions, checkIns, replies] = await Promise.all([
      this.prisma.interaction.findMany({
        where: {
          participants: { some: { userId: query.userId } },
          startsAt: { lt: before },
        },
        select: {
          id: true,
          kind: true,
          title: true,
          startsAt: true,
          challenges: true,
          createdBy: ref,
          impersonator: ref,
          activityType: typeRef,
          _count: {
            select: { readings: true, tasks: true, participants: true },
          },
        },
        orderBy: { startsAt: 'desc' },
        take,
      }),
      this.prisma.planReading.findMany({
        where: {
          ...menteePlan,
          source: 'CHECK_IN',
          recordedAt: { lt: before },
        },
        select: {
          id: true,
          value: true,
          note: true,
          recordedAt: true,
          author: ref,
          impersonator: ref,
          plan: { select: { id: true, name: true } },
        },
        orderBy: { recordedAt: 'desc' },
        take,
      }),
      this.prisma.planReply.findMany({
        where: { reading: menteePlan, createdAt: { lt: before } },
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: ref,
          impersonator: ref,
          reading: { select: { plan: { select: { id: true, name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take,
      }),
    ]);

    const items: FeedItemDto[] = [
      ...interactions.map((i) => ({
        ...blank,
        key: `${i.kind}:${i.id}`,
        kind: i.kind,
        at: i.startsAt.toISOString(),
        actor: i.createdBy,
        impersonator: i.impersonator,
        interactionId: i.id,
        title: i.title,
        activityType: i.activityType,
        planUpdates: i._count.readings,
        challenges: i.challenges.length,
        tasks: i._count.tasks,
        participants: i._count.participants,
      })),
      ...checkIns.map((r) => ({
        ...blank,
        key: `CHECK_IN:${r.id}`,
        kind: 'CHECK_IN' as const,
        at: r.recordedAt.toISOString(),
        actor: r.author,
        impersonator: r.impersonator,
        plan: r.plan,
        value: r.value,
        text: r.note,
      })),
      ...replies.map((r) => ({
        ...blank,
        key: `REPLY:${r.id}`,
        kind: 'REPLY' as const,
        at: r.createdAt.toISOString(),
        actor: r.author,
        impersonator: r.impersonator,
        plan: r.reading.plan,
        text: r.body,
      })),
    ].sort((a, b) => b.at.localeCompare(a.at));

    const page = items.slice(0, limit);
    return {
      items: page,
      nextCursor: items.length > limit ? page[page.length - 1].at : null,
    };
  }

  /** Follow-ups and activities that haven't started, that the user created or joins. */
  async upcoming(userId: string, take: number): Promise<UpcomingDto[]> {
    const rows = await this.prisma.interaction.findMany({
      where: {
        startsAt: { gt: new Date() },
        OR: [{ createdById: userId }, { participants: { some: { userId } } }],
      } satisfies Prisma.InteractionWhereInput,
      select: {
        id: true,
        kind: true,
        title: true,
        startsAt: true,
        place: true,
        createdBy: ref,
        activityType: typeRef,
        participants: {
          select: { user: ref },
          orderBy: { user: { name: 'asc' } },
        },
      },
      orderBy: { startsAt: 'asc' },
      take,
    });
    return rows.map((r) => ({
      ...r,
      startsAt: r.startsAt.toISOString(),
      participants: r.participants.map((p) => p.user),
    }));
  }
}
