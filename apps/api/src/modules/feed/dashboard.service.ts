import { Injectable } from '@nestjs/common';
import { PrismaService } from '@tarbya/db';
import { fromZoned, toZoned } from '@tarbya/shared';
import { taskSelect, toTaskDto } from '../interactions/interactions.service';
import { ContactService } from '../mentorships/contact.service';
import { MentorshipsService } from '../mentorships/mentorships.service';
import type { PlanSummaryDto } from '../plans/plans.dto';
import { PlansService } from '../plans/plans.service';
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
    private readonly plans: PlansService,
    private readonly feed: FeedService,
  ) {}

  async mentor(userId: string): Promise<MentorDashboardDto> {
    const mine = await this.mentorships.mine(userId);
    const [plans, month, upcoming, mentor] = await Promise.all([
      this.plans.openPlansOf(mine.mentees.map((m) => m.mentee.id)),
      this.monthCounts(userId),
      this.feed.upcoming(userId, 5),
      this.myMentor(userId),
    ]);
    const plansOf = new Map<string, PlanSummaryDto[]>();
    for (const p of plans) {
      plansOf.set(p.menteeId, [...(plansOf.get(p.menteeId) ?? []), p]);
    }
    const mentees: DashboardMenteeDto[] = mine.mentees.map((m) => {
      const own = plansOf.get(m.mentee.id) ?? [];
      return {
        ...m,
        mainPlan: mainPlan(own),
        openPlans: own.length,
        worseningPlans: own.filter((p) => p.trend === 'WORSE').length,
      };
    });
    const count = (trend: PlanSummaryDto['trend']) =>
      plans.filter((p) => p.trend === trend).length;
    return {
      stats: {
        mentees: mentees.length,
        needContact: mentees.filter((m) => m.contactStatus !== 'REGULAR')
          .length,
        monthFollowUps: month.FOLLOW_UP,
        monthActivities: month.ACTIVITY,
        openPlans: plans.length,
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
    const [mentorship, tasks, plans, upcoming] = await Promise.all([
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
      this.plans.openPlansOf([userId]),
      this.feed.upcoming(userId, 6),
    ]);
    return {
      mentor: mentorship?.mentor ?? null,
      tasks: tasks.map(toTaskDto),
      plans,
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
    const [contacts, openPlans] = await Promise.all([
      this.contact.lastContacts(ms.mentorId),
      this.prisma.developmentPlan.count({
        where: { menteeId: userId, closedAt: null },
      }),
    ]);
    return {
      user: ms.mentor,
      lastContactAt: contacts.get(ms.id)?.at.toISOString() ?? null,
      openPlans,
    };
  }
}

/** The open plan with the latest reading, else the newest one (they come newest first). */
function mainPlan(plans: PlanSummaryDto[]): PlanSummaryDto | null {
  return (
    plans
      .filter((p) => p.latestAt)
      .sort((a, b) => (b.latestAt ?? '').localeCompare(a.latestAt ?? ''))[0] ??
    plans[0] ??
    null
  );
}
