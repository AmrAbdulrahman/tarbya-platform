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
  trackableUpdates: 0,
  challenges: [],
  tasks: 0,
  participants: 0,
  trackable: null,
  cycle: null,
  value: null,
  text: null,
  group: null,
  present: null,
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
    const ofMentee = { trackable: { menteeId: query.userId } };
    const trackableRef = {
      select: { id: true, name: true, type: true, cycle: true },
    } as const;

    const [interactions, entries, replies, attendance] = await Promise.all([
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
          challenges: {
            select: { title: true },
            orderBy: { createdAt: 'asc' },
          },
          createdBy: ref,
          impersonator: ref,
          activityType: typeRef,
          _count: {
            select: { entries: true, tasks: true, participants: true },
          },
        },
        orderBy: { startsAt: 'desc' },
        take,
      }),
      // What the mentee logged; the mentor's entries show with their follow-up.
      this.prisma.trackableEntry.findMany({
        where: {
          ...ofMentee,
          source: 'MENTEE',
          recordedAt: { lt: before },
        },
        select: {
          id: true,
          value: true,
          note: true,
          periodStart: true,
          recordedAt: true,
          author: ref,
          impersonator: ref,
          trackable: trackableRef,
        },
        orderBy: { recordedAt: 'desc' },
        take,
      }),
      this.prisma.trackableReply.findMany({
        where: { entry: ofMentee, createdAt: { lt: before } },
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: ref,
          impersonator: ref,
          entry: { select: { periodStart: true, trackable: trackableRef } },
        },
        orderBy: { createdAt: 'desc' },
        take,
      }),
      // Gatherings the member was marked present or absent at (BR-GRP-9).
      this.prisma.attendance.findMany({
        where: {
          userId: query.userId,
          gathering: { startsAt: { lt: before }, cancelledAt: null },
        },
        select: {
          present: true,
          recordedBy: ref,
          impersonator: ref,
          gathering: {
            select: {
              id: true,
              title: true,
              startsAt: true,
              group: ref,
              activityType: typeRef,
            },
          },
        },
        orderBy: { gathering: { startsAt: 'desc' } },
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
        trackableUpdates: i._count.entries,
        challenges: i.challenges.map((c) => c.title),
        tasks: i._count.tasks,
        participants: i._count.participants,
      })),
      ...entries.map((r) => ({
        ...blank,
        key: `ENTRY:${r.id}`,
        kind: 'ENTRY' as const,
        at: r.recordedAt.toISOString(),
        actor: r.author,
        impersonator: r.impersonator,
        trackable: r.trackable,
        cycle: r.periodStart.toISOString().slice(0, 10),
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
        trackable: r.entry.trackable,
        cycle: r.entry.periodStart.toISOString().slice(0, 10),
        text: r.body,
      })),
      ...attendance.map((a) => ({
        ...blank,
        key: `GATHERING:${a.gathering.id}`,
        kind: 'GATHERING' as const,
        at: a.gathering.startsAt.toISOString(),
        actor: a.recordedBy,
        impersonator: a.impersonator,
        title: a.gathering.title,
        activityType: a.gathering.activityType,
        group: a.gathering.group,
        present: a.present,
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
