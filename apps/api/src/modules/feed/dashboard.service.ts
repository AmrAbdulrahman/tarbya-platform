import { Injectable } from '@nestjs/common';
import { PrismaService } from '@tarbya/db';
import { fromZoned, toZoned } from '@tarbya/shared';
import { taskSelect, toTaskDto } from '../interactions/interactions.service';
import { ContactService } from '../mentorships/contact.service';
import { MentorshipsService } from '../mentorships/mentorships.service';
import type { TrackableSummaryDto } from '../trackables/trackables.dto';
import { TrackablesService } from '../trackables/trackables.service';
import type {
  DashboardMenteeDto,
  JourneyDto,
  MentorDashboardDto,
  MyMentorDto,
} from './feed.dto';
import { FeedService } from './feed.service';

/** The mentor dashboard (US-4.1) and the mentee's journey (US-5.1). */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mentorships: MentorshipsService,
    private readonly contact: ContactService,
    private readonly trackables: TrackablesService,
    private readonly feed: FeedService,
  ) {}

  async mentor(userId: string): Promise<MentorDashboardDto> {
    const mine = await this.mentorships.mine(userId);
    const menteeIds = mine.mentees.map((m) => m.mentee.id);
    const [trackables, challenges, month, upcoming, mentor] = await Promise.all(
      [
        this.trackables.activeOf(menteeIds),
        this.prisma.challenge.groupBy({
          by: ['menteeId'],
          where: { menteeId: { in: menteeIds }, resolvedAt: null },
          _count: true,
        }),
        this.monthCounts(userId),
        this.feed.upcoming(userId, 5),
        this.myMentor(userId),
      ],
    );
    const trackablesOf = new Map<string, TrackableSummaryDto[]>();
    for (const t of trackables) {
      trackablesOf.set(t.menteeId, [
        ...(trackablesOf.get(t.menteeId) ?? []),
        t,
      ]);
    }
    const challengesOf = new Map(challenges.map((c) => [c.menteeId, c._count]));
    const mentees: DashboardMenteeDto[] = mine.mentees.map((m) => {
      const own = trackablesOf.get(m.mentee.id) ?? [];
      return {
        ...m,
        mainTrackable: mainTrackable(own),
        activeTrackables: own.length,
        worseningTrackables: own.filter((t) => t.trend === 'WORSE').length,
        openChallenges: challengesOf.get(m.mentee.id) ?? 0,
      };
    });
    const count = (trend: TrackableSummaryDto['trend']) =>
      trackables.filter((t) => t.trend === trend).length;
    return {
      stats: {
        mentees: mentees.length,
        needContact: mentees.filter((m) => m.contactStatus !== 'REGULAR')
          .length,
        monthFollowUps: month.FOLLOW_UP,
        monthActivities: month.ACTIVITY,
        activeTrackables: trackables.length,
        improving: count('IMPROVING'),
        steady: count('STEADY'),
        worse: count('WORSE'),
      },
      mentees,
      upcoming,
      mentor,
    };
  }

  async journey(userId: string): Promise<JourneyDto> {
    const [mentorship, tasks, trackables, upcoming] = await Promise.all([
      this.prisma.mentorship.findFirst({
        where: { menteeId: userId, endedAt: null },
        select: { mentor: { select: { id: true, name: true } } },
      }),
      this.prisma.task.findMany({
        where: { assigneeId: userId, doneAt: null },
        select: taskSelect,
        orderBy: [
          { dueOn: { sort: 'asc', nulls: 'last' } },
          { createdAt: 'asc' },
        ],
      }),
      this.trackables.activeOf([userId]),
      this.feed.upcoming(userId, 6),
    ]);
    return {
      mentor: mentorship?.mentor ?? null,
      tasks: tasks.map(toTaskDto),
      trackables,
      upcoming,
    };
  }

  /** Done follow-ups and activities the mentor logged this month, in the organisation zone. */
  private async monthCounts(userId: string) {
    const now = new Date();
    const monthStart = fromZoned({
      date: `${toZoned(now).date.slice(0, 7)}-01`,
      time: '00:00',
    });
    const rows = await this.prisma.interaction.groupBy({
      by: ['kind'],
      where: { createdById: userId, startsAt: { gte: monthStart, lte: now } },
      _count: true,
    });
    const of = (kind: 'FOLLOW_UP' | 'ACTIVITY') =>
      rows.find((r) => r.kind === kind)?._count ?? 0;
    return { FOLLOW_UP: of('FOLLOW_UP'), ACTIVITY: of('ACTIVITY') };
  }

  /** When the mentor is a mentee too (design/DECISIONS.md, "Roles"). */
  private async myMentor(userId: string): Promise<MyMentorDto | null> {
    const ms = await this.prisma.mentorship.findFirst({
      where: { menteeId: userId, endedAt: null },
      select: {
        id: true,
        mentorId: true,
        mentor: { select: { id: true, name: true } },
      },
    });
    if (!ms) return null;
    const [contacts, activeTrackables] = await Promise.all([
      this.contact.lastContacts(ms.mentorId),
      this.prisma.trackable.count({
        where: { menteeId: userId, archivedAt: null },
      }),
    ]);
    return {
      user: ms.mentor,
      lastContactAt: contacts.get(ms.id)?.at.toISOString() ?? null,
      activeTrackables,
    };
  }
}

/** The active trackable logged most recently, else the newest one (they come newest first). */
function mainTrackable(
  trackables: TrackableSummaryDto[],
): TrackableSummaryDto | null {
  return (
    trackables
      .filter((t) => t.latestCycle)
      .sort((a, b) =>
        (b.latestCycle ?? '').localeCompare(a.latestCycle ?? ''),
      )[0] ??
    trackables[0] ??
    null
  );
}
