import { Injectable } from '@nestjs/common';
import { PrismaService, type Prisma } from '@tarbya/db';
import {
  addDays,
  cycleEnd,
  cycleStart,
  FILL_WINDOW_DAYS,
  toZoned,
  trackableStats,
} from '@tarbya/shared';
import { forbidden } from '../../common/access';
import { AppException } from '../../common/app-exception';
import { impersonation } from '../../common/request-context';
import { MentoringAccess } from '../mentorships/mentoring-access.service';
import { SettingsService } from '../settings/settings.service';
import { RolesService } from '../users/roles.service';
import {
  describeTemplates,
  templateSelect,
  type TemplateRow,
} from './template-view';
import type {
  CreateTrackableDto,
  EntriesQuery,
  RangeEntryDto,
  LogEntryDto,
  TrackableDetailDto,
  TrackableEntryDto,
  TrackableSummaryDto,
  UpdateTrackableDto,
} from './trackables.dto';

const ref = { select: { id: true, name: true } } as const;

const trackableSelect = {
  id: true,
  menteeId: true,
  name: true,
  goal: true,
  type: true,
  cycle: true,
  higherIsBetter: true,
  target: true,
  startsOn: true,
  archivedAt: true,
  entries: {
    select: { periodStart: true, value: true },
    orderBy: { periodStart: 'asc' },
  },
} satisfies Prisma.TrackableSelect;

const entrySelect = {
  id: true,
  periodStart: true,
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
} satisfies Prisma.TrackableEntrySelect;

const toEntryDto = (
  e: Prisma.TrackableEntryGetPayload<{ select: typeof entrySelect }>,
): TrackableEntryDto => ({
  ...e,
  periodStart: day(e.periodStart),
  recordedAt: e.recordedAt.toISOString(),
  replies: e.replies.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  })),
});

type TrackableRow = Prisma.TrackableGetPayload<{
  select: typeof trackableSelect;
}>;

/** Date-only columns come back as UTC midnight. */
const day = (d: Date) => d.toISOString().slice(0, 10);
const asDate = (d: string) => new Date(`${d}T00:00:00Z`);

const notFound = () =>
  new AppException(404, { code: 'NOT_FOUND', title: 'Trackable not found' });
const archived = () =>
  new AppException(409, {
    code: 'TRACKABLE_ARCHIVED',
    title: 'Restore the trackable first',
  });
const fromTemplate = () =>
  new AppException(409, {
    code: 'TRACKABLE_FROM_TEMPLATE',
    title: 'This trackable follows a template; change it there',
  });
const outOfRange = () =>
  new AppException(409, {
    code: 'CYCLE_OUT_OF_RANGE',
    title: 'That cycle can no longer be logged',
  });

export interface EntryInput {
  value: number;
  note?: string | null;
  needsHelp?: boolean;
  /** The follow-up it's logged in, if any. */
  interactionId?: string;
}

/** Trackables (BR-TRK-1…6): the mentee's measures, logged once per cycle. */
@Injectable()
export class TrackablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: MentoringAccess,
    private readonly roles: RolesService,
    private readonly settings: SettingsService,
  ) {}

  /** Active ones first, then archived, each newest first. */
  async list(
    viewerId: string,
    menteeId: string,
  ): Promise<TrackableSummaryDto[]> {
    await this.access.assertCanView(viewerId, menteeId);
    const rows = await this.prisma.trackable.findMany({
      where: { menteeId },
      select: trackableSelect,
      orderBy: [
        { archivedAt: { sort: 'desc', nulls: 'first' } },
        { createdAt: 'desc' },
      ],
    });
    const options = await this.trendOptions();
    return rows.map((r) => this.summary(r, options));
  }

  /** Active trackables of several mentees, for the dashboards; callers have checked access. */
  async activeOf(menteeIds: string[]): Promise<TrackableSummaryDto[]> {
    if (!menteeIds.length) return [];
    const rows = await this.prisma.trackable.findMany({
      where: { menteeId: { in: menteeIds }, archivedAt: null },
      select: trackableSelect,
      orderBy: { createdAt: 'desc' },
    });
    const options = await this.trendOptions();
    return rows.map((r) => this.summary(r, options));
  }

  /** Entries whose cycle starts within [from, to], newest first; at most a year. */
  async entries(
    viewerId: string,
    query: EntriesQuery,
  ): Promise<RangeEntryDto[]> {
    await this.access.assertCanView(viewerId, query.menteeId);
    if (query.from > query.to || query.to > addDays(query.from, 366)) {
      throw new AppException(400, {
        code: 'VALIDATION_FAILED',
        title: 'Pick up to a year, from before to',
        errors: { to: ['must be on or after from, within a year'] },
      });
    }
    const rows = await this.prisma.trackableEntry.findMany({
      where: {
        trackable: { menteeId: query.menteeId },
        periodStart: { gte: asDate(query.from), lte: asDate(query.to) },
      },
      select: { trackableId: true, ...entrySelect },
      orderBy: { periodStart: 'desc' },
    });
    return rows.map((e) => ({ trackableId: e.trackableId, ...toEntryDto(e) }));
  }

  async get(viewerId: string, id: string): Promise<TrackableDetailDto> {
    const row = await this.prisma.trackable.findUnique({
      where: { id },
      select: {
        ...trackableSelect,
        mentee: ref,
        template: { select: templateSelect },
      },
    });
    if (!row) throw notFound();
    await this.access.assertCanView(viewerId, row.menteeId);
    const [canManage, template, entries] = await Promise.all([
      this.canManage(viewerId, row.menteeId),
      this.template(viewerId, row.template),
      this.prisma.trackableEntry.findMany({
        where: { trackableId: id },
        select: entrySelect,
        orderBy: { periodStart: 'desc' },
      }),
    ]);
    return {
      ...this.summary(row, await this.trendOptions()),
      mentee: row.mentee,
      template,
      entries: entries.map(toEntryDto),
      canManage,
      canLog: !row.archivedAt && (canManage || viewerId === row.menteeId),
    };
  }

  /** `templateId` when it's assigned from the library (BR-TRK-8). */
  async create(
    actorId: string,
    dto: CreateTrackableDto,
    templateId?: string,
  ): Promise<TrackableDetailDto> {
    await this.assertCanManage(actorId, dto.menteeId);
    const today = toZoned(new Date()).date;
    if (dto.startsOn && dto.startsOn > today) {
      throw new AppException(400, {
        code: 'VALIDATION_FAILED',
        title: 'Tracking starts today or earlier',
        errors: { startsOn: ['must not be in the future'] },
      });
    }
    const row = await this.prisma.trackable.create({
      data: {
        menteeId: dto.menteeId,
        createdById: actorId,
        ...impersonation(),
        templateId,
        name: dto.name,
        goal: dto.goal ?? null,
        type: dto.type,
        cycle: dto.cycle,
        higherIsBetter: dto.higherIsBetter ?? true,
        target: dto.target ?? null,
        startsOn: asDate(dto.startsOn ?? today),
      },
    });
    return this.get(actorId, row.id);
  }

  /** Edit, archive (archived: true) or restore (archived: false). */
  async update(
    actorId: string,
    id: string,
    dto: UpdateTrackableDto,
  ): Promise<TrackableDetailDto> {
    const row = await this.prisma.trackable.findUnique({
      where: { id },
      include: { _count: { select: { entries: true } } },
    });
    if (!row) throw notFound();
    await this.assertCanManage(actorId, row.menteeId);
    // Following a template, only the target, start and archiving are its own (BR-TRK-8).
    if (
      row.templateId &&
      ((dto.name !== undefined && dto.name !== row.name) ||
        (dto.goal !== undefined && (dto.goal ?? null) !== row.goal) ||
        (dto.type !== undefined && dto.type !== row.type) ||
        (dto.cycle !== undefined && dto.cycle !== row.cycle) ||
        (dto.higherIsBetter !== undefined &&
          dto.higherIsBetter !== row.higherIsBetter))
    ) {
      throw fromTemplate();
    }
    const reshaping =
      (dto.type && dto.type !== row.type) ||
      (dto.cycle && dto.cycle !== row.cycle) ||
      (dto.startsOn && dto.startsOn !== day(row.startsOn));
    if (reshaping && row._count.entries) {
      throw new AppException(409, {
        code: 'TRACKABLE_HAS_ENTRIES',
        title: 'Type, cycle and start are fixed once something is logged',
      });
    }
    if (dto.startsOn && dto.startsOn > toZoned(new Date()).date) {
      throw new AppException(400, {
        code: 'VALIDATION_FAILED',
        title: 'Tracking starts today or earlier',
        errors: { startsOn: ['must not be in the future'] },
      });
    }
    await this.prisma.trackable.update({
      where: { id },
      data: {
        name: dto.name,
        goal: dto.goal,
        type: dto.type,
        cycle: dto.cycle,
        startsOn: dto.startsOn ? asDate(dto.startsOn) : undefined,
        higherIsBetter: dto.higherIsBetter,
        target: dto.target,
        archivedAt:
          dto.archived === undefined
            ? undefined
            : dto.archived
              ? (row.archivedAt ?? new Date())
              : null,
      },
    });
    return this.get(actorId, id);
  }

  /**
   * Logs one cycle (BR-TRK-3, BR-TRK-4); logging it again replaces the value.
   * The mentee, their mentor or an admin; the mentee only within the last 30 days.
   */
  async log(
    actorId: string,
    id: string,
    periodStart: string,
    dto: LogEntryDto,
  ): Promise<TrackableDetailDto> {
    const row = await this.prisma.trackable.findUnique({ where: { id } });
    if (!row) throw notFound();
    const isMentee = actorId === row.menteeId;
    if (!isMentee) await this.assertCanManage(actorId, row.menteeId);
    await this.upsertEntry(this.prisma, row, periodStart, dto, {
      authorId: actorId,
      source: isMentee ? 'MENTEE' : 'MENTOR',
      limitToWindow: isMentee,
    });
    return this.get(actorId, id);
  }

  /**
   * Validates and writes one cycle's entry. Used by `log` and by follow-ups,
   * which pass their transaction.
   */
  async upsertEntry(
    db: Prisma.TransactionClient | PrismaService,
    row: {
      id: string;
      type: TrackableRow['type'];
      cycle: TrackableRow['cycle'];
      startsOn: Date;
      archivedAt: Date | null;
    },
    periodStart: string,
    input: EntryInput,
    by: {
      authorId: string;
      source: 'MENTEE' | 'MENTOR';
      limitToWindow: boolean;
    },
  ): Promise<void> {
    if (row.archivedAt) throw archived();
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(periodStart) ||
      Number.isNaN(Date.parse(periodStart)) ||
      cycleStart(periodStart, row.cycle) !== periodStart
    ) {
      throw new AppException(400, {
        code: 'VALIDATION_FAILED',
        title: "That day doesn't start a cycle",
        errors: { periodStart: ['must be the first day of a cycle'] },
      });
    }
    const today = toZoned(new Date()).date;
    const first = cycleStart(day(row.startsOn), row.cycle);
    if (periodStart < first || periodStart > cycleStart(today, row.cycle)) {
      throw outOfRange();
    }
    if (
      by.limitToWindow &&
      cycleEnd(periodStart, row.cycle) < addDays(today, -FILL_WINDOW_DAYS)
    ) {
      throw outOfRange();
    }
    if (
      (row.type === 'BOOLEAN' && input.value !== 0 && input.value !== 1) ||
      (row.type === 'PERCENTAGE' && input.value > 100)
    ) {
      throw new AppException(400, {
        code: 'VALIDATION_FAILED',
        title: 'The value does not fit this trackable',
        errors: {
          value: [row.type === 'BOOLEAN' ? 'must be 0 or 1' : 'must be 0–100'],
        },
      });
    }
    const data = {
      value: input.value,
      note: input.note ?? null,
      needsHelp: input.needsHelp ?? false,
      source: by.source,
      authorId: by.authorId,
      interactionId: input.interactionId ?? null,
      recordedAt: new Date(),
      ...impersonation(),
    };
    await db.trackableEntry.upsert({
      where: {
        trackableId_periodStart: {
          trackableId: row.id,
          periodStart: asDate(periodStart),
        },
      },
      create: {
        trackableId: row.id,
        periodStart: asDate(periodStart),
        ...data,
      },
      update: data,
    });
  }

  /** BR-TRK-6: the mentor (or an admin) answers an entry; it shows in its history. */
  async reply(
    actorId: string,
    entryId: string,
    body: string,
  ): Promise<TrackableDetailDto> {
    const entry = await this.prisma.trackableEntry.findUnique({
      where: { id: entryId },
      select: { trackableId: true, trackable: { select: { menteeId: true } } },
    });
    if (!entry) throw notFound();
    await this.assertCanManage(actorId, entry.trackable.menteeId);
    await this.prisma.trackableReply.create({
      data: { entryId, authorId: actorId, body, ...impersonation() },
    });
    return this.get(actorId, entry.trackableId);
  }

  private summary(
    r: TrackableRow,
    options: { window: number; steadyBand: number },
  ): TrackableSummaryDto {
    const entries = r.entries.map((e) => ({
      periodStart: day(e.periodStart),
      value: e.value,
    }));
    const stats = trackableStats({
      cycle: r.cycle,
      type: r.type,
      higherIsBetter: r.higherIsBetter,
      target: r.target,
      startsOn: day(r.startsOn),
      archivedOn: r.archivedAt ? toZoned(r.archivedAt).date : null,
      today: toZoned(new Date()).date,
      entries,
      ...options,
    });
    const last = entries[entries.length - 1];
    return {
      id: r.id,
      menteeId: r.menteeId,
      name: r.name,
      goal: r.goal,
      type: r.type,
      cycle: r.cycle,
      higherIsBetter: r.higherIsBetter,
      target: r.target,
      startsOn: day(r.startsOn),
      archivedAt: r.archivedAt?.toISOString() ?? null,
      currentCycle: stats.currentCycle,
      latestCycle: last?.periodStart ?? null,
      latest: last?.value ?? null,
      logged: stats.logged,
      missed: stats.missed,
      rate: stats.rate,
      openCycles: stats.openCycles,
      trend: stats.trend,
      change: Math.round(stats.change * 100) / 100,
      points: stats.points,
    };
  }

  /** The template it follows, as the viewer sees it. */
  private async template(viewerId: string, row: TemplateRow | null) {
    if (!row) return null;
    const [dto] = await describeTemplates(this.prisma, [row], {
      id: viewerId,
      isAdmin: await this.roles.isAdmin(viewerId),
    });
    return dto;
  }

  private async trendOptions() {
    const [window, steadyBand] = await Promise.all([
      this.settings.get('trackables.trendWindow'),
      this.settings.get('trackables.trendSteadyBand'),
    ]);
    return { window, steadyBand };
  }

  /** BR-TRK-6: the current mentor or an admin. */
  async canManage(viewerId: string, menteeId: string): Promise<boolean> {
    return (
      !!(await this.access.currentMentorship(viewerId, menteeId)) ||
      (await this.roles.isAdmin(viewerId))
    );
  }

  async assertCanManage(viewerId: string, menteeId: string) {
    if (!(await this.canManage(viewerId, menteeId))) throw forbidden();
  }
}
