import { Injectable, Logger } from '@nestjs/common';
import { PrismaService, type Prisma } from '@tarbya/db';
import {
  gatheringNotices,
  MATERIALISE_WEEKS,
  seriesOccurrences,
  toZoned,
  type NotificationType,
} from '@tarbya/shared';
import { forbidden } from '../../common/access';
import { AppException } from '../../common/app-exception';
import { impersonation } from '../../common/request-context';
import { AvatarsService } from '../files/avatars.service';
import { JobsService } from '../jobs/jobs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import { canManageGroup, GroupAccess } from './group-access.service';
import type {
  CreateGatheringDto,
  CreateSeriesDto,
  GatheringDto,
  GatheringPageDto,
  GatheringsQuery,
  GatheringSummaryDto,
  RemindResultDto,
  RsvpResponse,
  SaveAttendanceDto,
  SeriesDto,
  UpdateGatheringDto,
  UpdateSeriesDto,
} from './groups.dto';

export const gatheringTypeSelect = {
  id: true,
  nameAr: true,
  nameEn: true,
  color: true,
  scope: true,
  requiresRsvp: true,
  tracksAttendance: true,
  reminder: true,
  groupId: true,
} satisfies Prisma.ActivityTypeSelect;

export const gatheringSelect = {
  id: true,
  groupId: true,
  seriesId: true,
  title: true,
  startsAt: true,
  endsAt: true,
  place: true,
  cancelledAt: true,
  remindedAt: true,
  rsvpRequestedAt: true,
  group: {
    select: {
      name: true,
      memberships: { select: { userId: true } },
    },
  },
  activityType: { select: gatheringTypeSelect },
  rsvps: { select: { userId: true, response: true } },
  attendance: { select: { userId: true, present: true, note: true } },
} satisfies Prisma.GatheringSelect;

type GatheringRow = Prisma.GatheringGetPayload<{
  select: typeof gatheringSelect;
}>;

export const seriesSelect = {
  id: true,
  title: true,
  weekday: true,
  time: true,
  intervalWeeks: true,
  durationMinutes: true,
  place: true,
  startsOn: true,
  endsOn: true,
  activityType: { select: gatheringTypeSelect },
} satisfies Prisma.GatheringSeriesSelect;

const day = (d: Date) => d.toISOString().slice(0, 10);

export function toSeriesDto(
  s: Prisma.GatheringSeriesGetPayload<{ select: typeof seriesSelect }>,
): SeriesDto {
  return { ...s, startsOn: day(s.startsOn), endsOn: s.endsOn && day(s.endsOn) };
}

/** Counts against the group's current members, so the manager chain never counts (BR-GRP-4). */
export function toGatheringSummary(
  g: GatheringRow,
  viewerId: string,
): GatheringSummaryDto {
  const members = new Set(g.group.memberships.map((m) => m.userId));
  const rsvps = g.rsvps.filter((r) => members.has(r.userId));
  const attending = rsvps.filter((r) => r.response === 'ATTENDING').length;
  const marked = g.attendance.filter((a) => members.has(a.userId));
  return {
    id: g.id,
    groupId: g.groupId,
    groupName: g.group.name,
    seriesId: g.seriesId,
    activityType: g.activityType,
    title: g.title,
    startsAt: g.startsAt.toISOString(),
    endsAt: g.endsAt?.toISOString() ?? null,
    place: g.place,
    cancelledAt: g.cancelledAt?.toISOString() ?? null,
    counts: {
      members: members.size,
      attending,
      notAttending: rsvps.length - attending,
      noReply: members.size - rsvps.length,
      present: marked.length ? marked.filter((a) => a.present).length : null,
    },
    myRsvp: g.rsvps.find((r) => r.userId === viewerId)?.response ?? null,
    isMember: members.has(viewerId),
  };
}

const notFound = () =>
  new AppException(404, { code: 'NOT_FOUND', title: 'Gathering not found' });
const badType = () =>
  new AppException(400, {
    code: 'GATHERING_TYPE_INVALID',
    title: 'Pick an active gathering type for this group',
  });

const DAY_MS = 86_400_000;

/**
 * Gatherings (BR-GRP-5…9): recurring series materialised ahead, one-time group
 * activities, RSVPs, reminders and the attendance log.
 */
@Injectable()
export class GatheringsService {
  private readonly logger = new Logger(GatheringsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: GroupAccess,
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
    jobs: JobsService,
  ) {
    jobs.register(
      'gatherings.materialise',
      async () => {
        await this.materialise();
      },
      '0 2 * * *',
    );
    jobs.register(
      'gatherings.notices',
      () => this.sendNotices(),
      '*/10 * * * *',
    );
  }

  // ── Series (US-6.3) ──────────────────────────────────────────────────

  async createSeries(
    actorId: string,
    groupId: string,
    dto: CreateSeriesDto,
  ): Promise<SeriesDto> {
    await this.access.assertManage(actorId, groupId);
    await this.assertType(dto.activityTypeId, 'GROUP_RECURRING', groupId);
    const series = await this.prisma.gatheringSeries.create({
      data: {
        groupId,
        activityTypeId: dto.activityTypeId,
        title: dto.title ?? null,
        weekday: dto.weekday,
        time: dto.time,
        intervalWeeks: dto.intervalWeeks ?? 1,
        durationMinutes: dto.durationMinutes ?? 60,
        place: dto.place ?? null,
        startsOn: new Date(dto.startsOn ?? toZoned(new Date()).date),
      },
      select: seriesSelect,
    });
    await this.materialise(series.id);
    return toSeriesDto(series);
  }

  /**
   * Changes the schedule from now on: upcoming occurrences nobody changed by
   * hand are replaced by ones on the new schedule.
   */
  async updateSeries(
    actorId: string,
    id: string,
    dto: UpdateSeriesDto,
  ): Promise<SeriesDto> {
    const current = await this.prisma.gatheringSeries.findUnique({
      where: { id },
    });
    if (!current) throw notFound();
    await this.access.assertManage(actorId, current.groupId);
    if (dto.activityTypeId)
      await this.assertType(
        dto.activityTypeId,
        'GROUP_RECURRING',
        current.groupId,
      );
    const series = await this.prisma.$transaction(async (tx) => {
      await tx.gathering.deleteMany({
        where: {
          seriesId: id,
          customised: false,
          startsAt: { gt: new Date() },
        },
      });
      return tx.gatheringSeries.update({
        where: { id },
        data: {
          activityTypeId: dto.activityTypeId,
          title: dto.title,
          weekday: dto.weekday,
          time: dto.time,
          intervalWeeks: dto.intervalWeeks,
          durationMinutes: dto.durationMinutes,
          place: dto.place,
          startsOn: dto.startsOn ? new Date(dto.startsOn) : undefined,
        },
        select: seriesSelect,
      });
    });
    await this.materialise(id);
    return toSeriesDto(series);
  }

  /** Stops a series: past occurrences stay in the history; upcoming ones go. */
  async stopSeries(actorId: string, id: string): Promise<void> {
    const series = await this.prisma.gatheringSeries.findUnique({
      where: { id },
    });
    if (!series) throw notFound();
    await this.access.assertManage(actorId, series.groupId);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.gathering.updateMany({
        where: { seriesId: id, startsAt: { gt: now }, cancelledAt: null },
        data: { cancelledAt: now },
      }),
      this.prisma.gatheringSeries.update({
        where: { id },
        data: { endsOn: new Date(toZoned(now).date) },
      }),
    ]);
  }

  /** Creates occurrences for the coming weeks (daily job, and after a series changes). */
  async materialise(seriesId?: string): Promise<number> {
    const now = new Date();
    const until = new Date(now.getTime() + MATERIALISE_WEEKS * 7 * DAY_MS);
    const series = await this.prisma.gatheringSeries.findMany({
      where: {
        ...(seriesId && { id: seriesId }),
        group: { archivedAt: null },
        OR: [{ endsOn: null }, { endsOn: { gte: new Date(day(now)) } }],
      },
    });
    let created = 0;
    for (const s of series) {
      const slots = seriesOccurrences(
        {
          weekday: s.weekday,
          time: s.time,
          intervalWeeks: s.intervalWeeks,
          startsOn: day(s.startsOn),
          endsOn: s.endsOn && day(s.endsOn),
        },
        now,
        until,
      );
      if (!slots.length) continue;
      const result = await this.prisma.gathering.createMany({
        data: slots.map((at) => ({
          groupId: s.groupId,
          seriesId: s.id,
          scheduledFor: at,
          activityTypeId: s.activityTypeId,
          title: s.title,
          startsAt: at,
          endsAt: new Date(at.getTime() + s.durationMinutes * 60_000),
          place: s.place,
        })),
        skipDuplicates: true,
      });
      created += result.count;
    }
    return created;
  }

  // ── Occurrences ──────────────────────────────────────────────────────

  async list(
    viewerId: string,
    groupId: string,
    query: GatheringsQuery,
  ): Promise<GatheringPageDto> {
    await this.access.assertView(viewerId, groupId);
    const limit = query.limit ?? 10;
    const now = new Date();
    const past = query.when === 'past';
    const before = query.before ? new Date(query.before) : now;
    const rows = await this.prisma.gathering.findMany({
      where: {
        groupId,
        startsAt: past
          ? { lt: before < now ? before : now }
          : { gte: new Date(now.getTime() - 3 * 3_600_000) },
        ...(past && { cancelledAt: null }),
      },
      select: gatheringSelect,
      orderBy: { startsAt: past ? 'desc' : 'asc' },
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    return {
      items: page.map((g) => toGatheringSummary(g, viewerId)),
      nextCursor:
        past && rows.length > limit
          ? page[page.length - 1].startsAt.toISOString()
          : null,
    };
  }

  /** The member's upcoming gatherings across their groups (US-5.1). */
  async upcomingFor(userId: string, limit = 5): Promise<GatheringSummaryDto[]> {
    const rows = await this.prisma.gathering.findMany({
      where: {
        cancelledAt: null,
        startsAt: { gt: new Date() },
        group: {
          archivedAt: null,
          memberships: { some: { userId } },
        },
      },
      select: gatheringSelect,
      orderBy: { startsAt: 'asc' },
      take: limit,
    });
    return rows.map((g) => toGatheringSummary(g, userId));
  }

  async get(viewerId: string, id: string): Promise<GatheringDto> {
    const g = await this.prisma.gathering.findUnique({
      where: { id },
      select: gatheringSelect,
    });
    if (!g) throw notFound();
    const view = await this.access.assertView(viewerId, g.groupId);
    return this.toDto(g, viewerId, canManageGroup(view));
  }

  /** A one-time group activity (BR-GRP-6). */
  async createOneOff(
    actorId: string,
    groupId: string,
    dto: CreateGatheringDto,
  ): Promise<GatheringDto> {
    await this.access.assertManage(actorId, groupId);
    await this.assertType(dto.activityTypeId, 'GROUP_ONE_OFF', groupId);
    const g = await this.prisma.gathering.create({
      data: {
        groupId,
        activityTypeId: dto.activityTypeId,
        title: dto.title,
        startsAt: new Date(dto.startsAt),
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        place: dto.place ?? null,
        createdById: actorId,
        ...impersonation(),
      },
      select: gatheringSelect,
    });
    return this.toDto(g, actorId, true);
  }

  /** Edit or cancel one occurrence (US-6.3); a moved one gets asked again. */
  async update(
    actorId: string,
    id: string,
    dto: UpdateGatheringDto,
  ): Promise<GatheringDto> {
    const current = await this.prisma.gathering.findUnique({ where: { id } });
    if (!current) throw notFound();
    await this.access.assertManage(actorId, current.groupId);
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : undefined;
    const moved =
      !!startsAt && startsAt.getTime() !== current.startsAt.getTime();
    const g = await this.prisma.gathering.update({
      where: { id },
      data: {
        title: dto.title,
        place: dto.place,
        ...(moved && {
          startsAt,
          endsAt:
            current.endsAt &&
            new Date(
              current.endsAt.getTime() -
                current.startsAt.getTime() +
                startsAt.getTime(),
            ),
          rsvpRequestedAt: null,
          remindedAt: null,
        }),
        ...(dto.cancelled === true &&
          !current.cancelledAt && { cancelledAt: new Date() }),
        ...(dto.cancelled === false && { cancelledAt: null }),
        customised: true,
      },
      select: gatheringSelect,
    });
    return this.toDto(g, actorId, true);
  }

  /** A member answers for themself (BR-GRP-7). */
  async rsvp(
    userId: string,
    id: string,
    response: RsvpResponse,
  ): Promise<GatheringDto> {
    const g = await this.prisma.gathering.findUnique({
      where: { id },
      select: { groupId: true, cancelledAt: true, startsAt: true },
    });
    if (!g) throw notFound();
    const view = await this.access.assertView(userId, g.groupId);
    if (!view.role) throw forbidden();
    if (g.cancelledAt) {
      throw new AppException(409, {
        code: 'GATHERING_CANCELLED',
        title: 'This gathering is cancelled',
      });
    }
    await this.prisma.rsvp.upsert({
      where: { gatheringId_userId: { gatheringId: id, userId } },
      create: { gatheringId: id, userId, response, ...impersonation() },
      update: { response, respondedAt: new Date(), ...impersonation() },
    });
    return this.get(userId, id);
  }

  /** The attendance log (BR-GRP-8): one row per member, with a note. */
  async saveAttendance(
    actorId: string,
    id: string,
    dto: SaveAttendanceDto,
  ): Promise<GatheringDto> {
    const g = await this.prisma.gathering.findUnique({
      where: { id },
      select: {
        groupId: true,
        group: { select: { memberships: { select: { userId: true } } } },
      },
    });
    if (!g) throw notFound();
    await this.access.assertManage(actorId, g.groupId);
    const members = new Set(g.group.memberships.map((m) => m.userId));
    const rows = dto.rows.filter((r) => members.has(r.userId));
    await this.prisma.$transaction(
      rows.map((r) =>
        this.prisma.attendance.upsert({
          where: { gatheringId_userId: { gatheringId: id, userId: r.userId } },
          create: {
            gatheringId: id,
            userId: r.userId,
            present: r.present,
            note: r.note ?? null,
            recordedById: actorId,
            ...impersonation(),
          },
          update: {
            present: r.present,
            note: r.note ?? null,
            recordedById: actorId,
            ...impersonation(),
          },
        }),
      ),
    );
    return this.get(actorId, id);
  }

  /** "Remind those who haven't replied" (design/screens/Group.dc.html). */
  async remind(actorId: string, id: string): Promise<RemindResultDto> {
    const g = await this.prisma.gathering.findUnique({
      where: { id },
      select: gatheringSelect,
    });
    if (!g) throw notFound();
    await this.access.assertManage(actorId, g.groupId);
    if (g.cancelledAt || g.startsAt <= new Date()) return { notified: 0 };
    const replied = new Set(g.rsvps.map((r) => r.userId));
    const notified = await this.notify(
      g,
      g.group.memberships.map((m) => m.userId).filter((u) => !replied.has(u)),
      'GATHERING_REMINDER',
      true,
      actorId,
    );
    await this.prisma.gathering.update({
      where: { id },
      data: { remindedAt: new Date() },
    });
    return { notified: notified.length };
  }

  /**
   * Every few minutes: RSVP requests and reminders that have come due
   * (BR-GRP-7, US-6.5). Each is sent once per occurrence.
   */
  async sendNotices(now = new Date()): Promise<void> {
    const [rsvpRequestHours, reminderHours] = await Promise.all([
      this.settings.get('gatherings.rsvpRequestHours'),
      this.settings.get('gatherings.reminderHours'),
    ]);
    const horizon = Math.max(rsvpRequestHours, reminderHours, 48);
    const due = await this.prisma.gathering.findMany({
      where: {
        cancelledAt: null,
        startsAt: {
          gt: now,
          lte: new Date(now.getTime() + horizon * 3_600_000),
        },
        OR: [{ rsvpRequestedAt: null }, { remindedAt: null }],
        group: { archivedAt: null },
      },
      select: gatheringSelect,
    });
    for (const g of due) {
      const { request, remind } = gatheringNotices(
        {
          startsAt: g.startsAt,
          requiresRsvp: g.activityType.requiresRsvp,
          reminder: g.activityType.reminder,
          rsvpRequestedAt: g.rsvpRequestedAt,
          remindedAt: g.remindedAt,
        },
        now,
        { rsvpRequestHours, reminderHours },
      );
      const members = g.group.memberships.map((m) => m.userId);
      if (request) {
        await this.notify(g, members, 'GATHERING_RSVP_REQUEST', true);
      }
      if (remind) {
        // Members who haven't replied are asked again; those coming are reminded.
        const answers = new Map(g.rsvps.map((r) => [r.userId, r.response]));
        const ask = g.activityType.requiresRsvp
          ? members.filter((u) => !answers.has(u))
          : [];
        const coming = members.filter(
          (u) => !ask.includes(u) && answers.get(u) !== 'NOT_ATTENDING',
        );
        // Just asked in this same pass: one notice is enough.
        if (!request) await this.notify(g, ask, 'GATHERING_REMINDER', true);
        await this.notify(g, coming, 'GATHERING_REMINDER', false);
      }
      if (request || remind) {
        await this.prisma.gathering.update({
          where: { id: g.id },
          data: {
            ...(request && { rsvpRequestedAt: now }),
            ...(remind && { remindedAt: now }),
          },
        });
      }
    }
    if (due.length) this.logger.log(`Checked ${due.length} gatherings`);
  }

  private notify(
    g: GatheringRow,
    userIds: string[],
    type: NotificationType,
    needsRsvp: boolean,
    actorId?: string,
  ) {
    return this.notifications.notify(
      userIds,
      type,
      {
        gatheringId: g.id,
        groupId: g.groupId,
        groupName: g.group.name,
        title: g.title,
        typeNameAr: g.activityType.nameAr,
        typeNameEn: g.activityType.nameEn,
        startsAt: g.startsAt.toISOString(),
        place: g.place,
        needsRsvp,
      },
      { actorId },
    );
  }

  private async toDto(
    g: GatheringRow,
    viewerId: string,
    canManage: boolean,
  ): Promise<GatheringDto> {
    const members = await this.prisma.groupMembership.findMany({
      where: { groupId: g.groupId },
      select: {
        role: true,
        user: { select: { id: true, name: true, avatarFileId: true } },
      },
      orderBy: [{ role: 'asc' }, { user: { name: 'asc' } }],
    });
    const rsvps = new Map(g.rsvps.map((r) => [r.userId, r.response]));
    const marks = new Map(g.attendance.map((a) => [a.userId, a]));
    return {
      ...toGatheringSummary(g, viewerId),
      canManage,
      remindedAt: g.remindedAt?.toISOString() ?? null,
      rows: members.map(({ role, user }) => ({
        member: {
          id: user.id,
          name: user.name,
          avatarUrl: AvatarsService.url(user.id, user.avatarFileId),
        },
        role,
        rsvp: rsvps.get(user.id) ?? null,
        present: marks.get(user.id)?.present ?? null,
        note: marks.get(user.id)?.note ?? null,
      })),
    };
  }

  private async assertType(
    id: string,
    scope: 'GROUP_RECURRING' | 'GROUP_ONE_OFF',
    groupId: string,
  ) {
    const type = await this.prisma.activityType.findUnique({ where: { id } });
    if (
      !type ||
      !type.active ||
      type.scope !== scope ||
      (type.groupId && type.groupId !== groupId)
    )
      throw badType();
  }
}
