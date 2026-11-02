import { Injectable } from '@nestjs/common';
import { PrismaService, type Prisma } from '@tarbya/db';
import { daysSince, planTrend } from '@tarbya/shared';
import { forbidden } from '../../common/access';
import { AppException } from '../../common/app-exception';
import { impersonation } from '../../common/request-context';
import { MentoringAccess } from '../mentorships/mentoring-access.service';
import { SettingsService } from '../settings/settings.service';
import { RolesService } from '../users/roles.service';
import type {
  CheckInDto,
  CreatePlanDto,
  PlanDetailDto,
  PlanReadingDto,
  PlanSummaryDto,
  UpdatePlanDto,
} from './plans.dto';

const ref = { select: { id: true, name: true } } as const;

const planSelect = {
  id: true,
  menteeId: true,
  name: true,
  goal: true,
  target: true,
  higherIsBetter: true,
  endsOn: true,
  closedAt: true,
  createdAt: true,
  trackingMethod: { select: { id: true, nameAr: true, nameEn: true } },
  readings: {
    select: { value: true, recordedAt: true },
    orderBy: { recordedAt: 'asc' },
  },
} satisfies Prisma.DevelopmentPlanSelect;

type PlanRow = Prisma.DevelopmentPlanGetPayload<{ select: typeof planSelect }>;

const notFound = () =>
  new AppException(404, { code: 'NOT_FOUND', title: 'Plan not found' });
const closed = () =>
  new AppException(409, {
    code: 'PLAN_CLOSED',
    title: 'Reopen the plan first',
  });

/** Development plans (US-4.5), check-ins (US-5.2) and replies (US-4.7). */
@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: MentoringAccess,
    private readonly roles: RolesService,
    private readonly settings: SettingsService,
  ) {}

  /** Open plans first, then closed ones, each newest first. */
  async list(viewerId: string, menteeId: string): Promise<PlanSummaryDto[]> {
    await this.access.assertCanView(viewerId, menteeId);
    const rows = await this.prisma.developmentPlan.findMany({
      where: { menteeId },
      select: planSelect,
      orderBy: [
        { closedAt: { sort: 'desc', nulls: 'first' } },
        { createdAt: 'desc' },
      ],
    });
    const trend = await this.trendOptions();
    return rows.map((r) => this.summary(r, trend));
  }

  /**
   * Open plans of several mentees, newest first, for the dashboards. Callers
   * have already checked the viewer may see these mentees.
   */
  async openPlansOf(menteeIds: string[]): Promise<PlanSummaryDto[]> {
    if (!menteeIds.length) return [];
    const rows = await this.prisma.developmentPlan.findMany({
      where: { menteeId: { in: menteeIds }, closedAt: null },
      select: planSelect,
      orderBy: { createdAt: 'desc' },
    });
    const trend = await this.trendOptions();
    return rows.map((r) => this.summary(r, trend));
  }

  async get(viewerId: string, id: string): Promise<PlanDetailDto> {
    const plan = await this.prisma.developmentPlan.findUnique({
      where: { id },
      select: {
        ...planSelect,
        mentee: ref,
        readings: {
          select: {
            id: true,
            value: true,
            note: true,
            source: true,
            needsHelp: true,
            recordedAt: true,
            author: ref,
            impersonator: ref,
            replies: {
              select: {
                id: true,
                body: true,
                createdAt: true,
                author: ref,
                impersonator: ref,
              },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { recordedAt: 'asc' },
        },
      },
    });
    if (!plan) throw notFound();
    await this.access.assertCanView(viewerId, plan.menteeId);
    const canManage = await this.canManage(viewerId, plan.menteeId);
    const readings: PlanReadingDto[] = plan.readings
      .map((r) => ({
        id: r.id,
        value: r.value,
        note: r.note,
        source: r.source,
        needsHelp: r.needsHelp,
        recordedAt: r.recordedAt.toISOString(),
        author: r.author,
        impersonator: r.impersonator,
        replies: r.replies.map((x) => ({
          ...x,
          createdAt: x.createdAt.toISOString(),
        })),
      }))
      .reverse();
    return {
      ...this.summary(plan, await this.trendOptions()),
      mentee: plan.mentee,
      readings,
      canManage,
      canCheckIn: viewerId === plan.menteeId && !plan.closedAt,
    };
  }

  async create(actorId: string, dto: CreatePlanDto): Promise<PlanDetailDto> {
    await this.assertCanManage(actorId, dto.menteeId);
    await this.assertTrackingMethod(dto.trackingMethodId);
    const plan = await this.prisma.developmentPlan.create({
      data: {
        menteeId: dto.menteeId,
        createdById: actorId,
        ...impersonation(),
        name: dto.name,
        goal: dto.goal,
        trackingMethodId: dto.trackingMethodId,
        target: dto.target,
        higherIsBetter: dto.higherIsBetter ?? true,
        endsOn: dto.endsOn ? new Date(`${dto.endsOn}T00:00:00Z`) : null,
      },
    });
    return this.get(actorId, plan.id);
  }

  /** Edit, close (closed: true) or reopen (closed: false). */
  async update(
    actorId: string,
    id: string,
    dto: UpdatePlanDto,
  ): Promise<PlanDetailDto> {
    const plan = await this.prisma.developmentPlan.findUnique({
      where: { id },
    });
    if (!plan) throw notFound();
    await this.assertCanManage(actorId, plan.menteeId);
    if (
      dto.trackingMethodId &&
      dto.trackingMethodId !== plan.trackingMethodId
    ) {
      await this.assertTrackingMethod(dto.trackingMethodId);
    }
    await this.prisma.developmentPlan.update({
      where: { id },
      data: {
        name: dto.name,
        goal: dto.goal,
        trackingMethodId: dto.trackingMethodId,
        target: dto.target,
        higherIsBetter: dto.higherIsBetter,
        endsOn:
          dto.endsOn === undefined
            ? undefined
            : dto.endsOn
              ? new Date(`${dto.endsOn}T00:00:00Z`)
              : null,
        closedAt:
          dto.closed === undefined
            ? undefined
            : dto.closed
              ? (plan.closedAt ?? new Date())
              : null,
      },
    });
    return this.get(actorId, id);
  }

  /** US-5.2: the mentee reports progress. */
  async checkIn(
    actorId: string,
    planId: string,
    dto: CheckInDto,
  ): Promise<PlanDetailDto> {
    const plan = await this.prisma.developmentPlan.findUnique({
      where: { id: planId },
    });
    if (!plan) throw notFound();
    if (plan.menteeId !== actorId) throw forbidden();
    if (plan.closedAt) throw closed();
    await this.prisma.planReading.create({
      data: {
        planId,
        value: dto.value,
        note: dto.note ?? null,
        needsHelp: dto.needsHelp ?? false,
        source: 'CHECK_IN',
        authorId: actorId,
        ...impersonation(),
      },
    });
    return this.get(actorId, planId);
  }

  /** BR-PLAN-5: the mentor answers a check-in; it shows in the plan's history. */
  async reply(
    actorId: string,
    readingId: string,
    body: string,
  ): Promise<PlanDetailDto> {
    const reading = await this.prisma.planReading.findUnique({
      where: { id: readingId },
      select: { planId: true, plan: { select: { menteeId: true } } },
    });
    if (!reading) throw notFound();
    await this.assertCanManage(actorId, reading.plan.menteeId);
    await this.prisma.planReply.create({
      data: { readingId, authorId: actorId, body, ...impersonation() },
    });
    return this.get(actorId, reading.planId);
  }

  private summary(
    r: PlanRow,
    {
      checkInDays,
      ...trend
    }: { window: number; steadyBand: number; checkInDays: number },
  ): PlanSummaryDto {
    const values = r.readings.map((x) => x.value);
    const last = r.readings[r.readings.length - 1];
    const result = planTrend(values, {
      ...trend,
      higherIsBetter: r.higherIsBetter,
      target: r.target,
    });
    const quietSince = last?.recordedAt ?? r.createdAt;
    return {
      id: r.id,
      menteeId: r.menteeId,
      name: r.name,
      goal: r.goal,
      trackingMethod: r.trackingMethod,
      target: r.target,
      higherIsBetter: r.higherIsBetter,
      endsOn: r.endsOn?.toISOString().slice(0, 10) ?? null,
      closedAt: r.closedAt?.toISOString() ?? null,
      latest: last?.value ?? null,
      latestAt: last?.recordedAt.toISOString() ?? null,
      trend: result.trend,
      change: Math.round(result.change * 100) / 100,
      points: values.slice(-12),
      checkInDue:
        !r.closedAt && daysSince(quietSince, new Date()) >= checkInDays,
    };
  }

  private async trendOptions() {
    const [window, steadyBand, checkInDays] = await Promise.all([
      this.settings.get('plans.trendWindow'),
      this.settings.get('plans.trendSteadyBand'),
      this.settings.get('plans.checkInDays'),
    ]);
    return { window, steadyBand, checkInDays };
  }

  /** BR-PLAN-2: the current mentor or a moderator. */
  async canManage(viewerId: string, menteeId: string): Promise<boolean> {
    return (
      !!(await this.access.currentMentorship(viewerId, menteeId)) ||
      (await this.roles.isAdmin(viewerId))
    );
  }

  private async assertCanManage(viewerId: string, menteeId: string) {
    if (!(await this.canManage(viewerId, menteeId))) throw forbidden();
  }

  private async assertTrackingMethod(id: string) {
    const method = await this.prisma.trackingMethod.findUnique({
      where: { id },
    });
    if (!method?.active) {
      throw new AppException(400, {
        code: 'TRACKING_METHOD_INVALID',
        title: 'Pick an active tracking method',
      });
    }
  }
}
