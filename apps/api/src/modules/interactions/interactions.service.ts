import { Injectable } from '@nestjs/common';
import { PrismaService, type Prisma } from '@tarbya/db';
import { cycleStart, interactionStatus, toZoned } from '@tarbya/shared';
import { forbidden } from '../../common/access';
import { AppException } from '../../common/app-exception';
import { impersonation } from '../../common/request-context';
import { MentoringAccess } from '../mentorships/mentoring-access.service';
import { TrackablesService } from '../trackables/trackables.service';
import { RolesService } from '../users/roles.service';
import type {
  CreateActivityDto,
  CreateFollowUpDto,
  InteractionDto,
  InteractionPageDto,
  NewTaskDto,
  TaskDto,
  TimelineQuery,
} from './interactions.dto';

const ref = { select: { id: true, name: true } } as const;

export const taskSelect = {
  id: true,
  title: true,
  dueOn: true,
  doneAt: true,
  interactionId: true,
  assignee: ref,
} satisfies Prisma.TaskSelect;

// privateNotes is deliberately absent: it is read separately, only for those allowed.
const interactionSelect = {
  id: true,
  kind: true,
  title: true,
  startsAt: true,
  endsAt: true,
  place: true,
  sharedNotes: true,
  challenges: { select: { title: true }, orderBy: { createdAt: 'asc' } },
  createdById: true,
  createdBy: ref,
  impersonator: ref,
  activityType: {
    select: { id: true, nameAr: true, nameEn: true, color: true },
  },
  participants: { select: { user: ref }, orderBy: { user: { name: 'asc' } } },
  tasks: { select: taskSelect, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.InteractionSelect;

type Row = Prisma.InteractionGetPayload<{ select: typeof interactionSelect }>;

export function toTaskDto(
  t: Prisma.TaskGetPayload<{ select: typeof taskSelect }>,
): TaskDto {
  return {
    id: t.id,
    title: t.title,
    dueOn: t.dueOn?.toISOString().slice(0, 10) ?? null,
    doneAt: t.doneAt?.toISOString() ?? null,
    assignee: t.assignee,
    interactionId: t.interactionId,
  };
}

/** Follow-ups (US-4.3) and activities (US-4.4). */
@Injectable()
export class InteractionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: MentoringAccess,
    private readonly roles: RolesService,
    private readonly trackables: TrackablesService,
  ) {}

  async createFollowUp(
    actorId: string,
    dto: CreateFollowUpDto,
  ): Promise<InteractionDto> {
    const mentorship = await this.access.assertCurrentMentor(
      actorId,
      dto.menteeId,
    );
    const startsAt = new Date(dto.startsAt);
    const updates = dto.trackableUpdates ?? [];
    const notes = dto.challengeNotes ?? [];
    const trackables = updates.length
      ? await this.trackablesFor(dto.menteeId, startsAt, updates)
      : new Map();
    if (notes.length) {
      const ids = [...new Set(notes.map((n) => n.challengeId))];
      const mine = await this.prisma.challenge.count({
        where: { id: { in: ids }, menteeId: dto.menteeId },
      });
      if (mine !== ids.length || ids.length !== notes.length) {
        throw new AppException(400, {
          code: 'VALIDATION_FAILED',
          title: "Each note must be for one of the mentee's challenges, once",
          errors: { challengeNotes: ['unknown or repeated challenge'] },
        });
      }
    }
    // The follow-up's day decides which cycle each update fills.
    const followUpDay = toZoned(startsAt).date;

    const created = await this.prisma.$transaction(async (tx) => {
      const interaction = await tx.interaction.create({
        data: {
          kind: 'FOLLOW_UP',
          mentorshipId: mentorship.id,
          createdById: actorId,
          ...impersonation(),
          startsAt,
          place: dto.place ?? null,
          sharedNotes: dto.sharedNotes ?? null,
          privateNotes: dto.privateNotes ?? null,
          participants: { create: [{ userId: dto.menteeId }] },
          tasks: {
            create: (dto.tasks ?? []).map((t) =>
              newTask(t, dto.menteeId, actorId),
            ),
          },
          challenges: {
            create: (dto.challenges ?? []).map((title) => ({
              menteeId: dto.menteeId,
              createdById: actorId,
              title,
              ...impersonation(),
            })),
          },
        },
      });
      for (const note of notes) {
        if (note.comment) {
          await tx.challengeComment.create({
            data: {
              challengeId: note.challengeId,
              authorId: actorId,
              interactionId: interaction.id,
              body: note.comment,
              ...impersonation(),
            },
          });
        }
        if (note.resolve) {
          await tx.challenge.updateMany({
            where: { id: note.challengeId, resolvedAt: null },
            data: { resolvedAt: startsAt, resolvedById: actorId },
          });
        }
      }
      for (const u of updates) {
        const row = trackables.get(u.trackableId);
        await this.trackables.upsertEntry(
          tx,
          row,
          cycleStart(followUpDay, row.cycle),
          { value: u.value, note: u.note, interactionId: interaction.id },
          { authorId: actorId, source: 'MENTOR', limitToWindow: false },
        );
      }
      return interaction;
    });
    return this.get(actorId, created.id);
  }

  /** The mentee's active trackables the updates name, each once, for a follow-up that has happened. */
  private async trackablesFor(
    menteeId: string,
    startsAt: Date,
    updates: { trackableId: string }[],
  ) {
    // Entries describe what happened; an upcoming follow-up has nothing to log yet.
    if (startsAt > new Date()) {
      throw new AppException(400, {
        code: 'VALIDATION_FAILED',
        title: 'Trackable updates need a follow-up that has happened',
        errors: { trackableUpdates: ['only for a follow-up in the past'] },
      });
    }
    const ids = [...new Set(updates.map((u) => u.trackableId))];
    const rows = await this.prisma.trackable.findMany({
      where: { id: { in: ids }, menteeId, archivedAt: null },
      select: {
        id: true,
        type: true,
        cycle: true,
        startsOn: true,
        archivedAt: true,
      },
    });
    if (rows.length !== ids.length || ids.length !== updates.length) {
      throw new AppException(400, {
        code: 'VALIDATION_FAILED',
        title:
          "Each update must be for one of the mentee's active trackables, once",
        errors: {
          trackableUpdates: ['unknown, archived or repeated trackable'],
        },
      });
    }
    return new Map(rows.map((r) => [r.id, r]));
  }

  async createActivity(
    actorId: string,
    dto: CreateActivityDto,
  ): Promise<InteractionDto> {
    await this.access.assertMentorOrAdmin(actorId);
    const type = await this.prisma.activityType.findUnique({
      where: { id: dto.activityTypeId },
    });
    if (!type?.active || type.scope !== 'INDIVIDUAL') {
      throw new AppException(400, {
        code: 'ACTIVITY_TYPE_INVALID',
        title: 'Pick an active one-to-one activity type',
      });
    }
    if (dto.endsAt && new Date(dto.endsAt) < new Date(dto.startsAt)) {
      throw new AppException(400, {
        code: 'VALIDATION_FAILED',
        title: 'The return date is before the start',
        errors: { endsAt: ['must not be before startsAt'] },
      });
    }
    // The creator takes part anyway; listing them as a participant would count them twice.
    const participantIds = dto.participantIds.filter((id) => id !== actorId);
    const active = await this.prisma.user.count({
      where: { id: { in: participantIds }, deactivatedAt: null },
    });
    if (!participantIds.length || active !== participantIds.length) {
      throw new AppException(409, {
        code: 'USER_INACTIVE',
        title: 'Every participant must be an active user',
      });
    }
    const created = await this.prisma.interaction.create({
      data: {
        kind: 'ACTIVITY',
        activityTypeId: type.id,
        createdById: actorId,
        ...impersonation(),
        title: dto.title,
        startsAt: new Date(dto.startsAt),
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        place: dto.place ?? null,
        sharedNotes: dto.sharedNotes ?? null,
        privateNotes: dto.privateNotes ?? null,
        participants: { create: participantIds.map((userId) => ({ userId })) },
      },
    });
    return this.get(actorId, created.id);
  }

  /** The creator, a participant, a participant's mentor, or an admin. */
  async get(viewerId: string, id: string): Promise<InteractionDto> {
    const row = await this.prisma.interaction.findUnique({
      where: { id },
      select: interactionSelect,
    });
    if (!row)
      throw new AppException(404, { code: 'NOT_FOUND', title: 'Not found' });
    if (!(await this.canSee(viewerId, row))) throw forbidden();
    return (await this.withPrivateNotes(viewerId, [row]))[0];
  }

  /** A member's follow-ups and activities, newest first, for them, their mentor and admins. */
  async timeline(
    viewerId: string,
    query: TimelineQuery,
  ): Promise<InteractionPageDto> {
    await this.access.assertCanView(viewerId, query.userId);
    const limit = query.limit ?? 20;
    const rows = await this.prisma.interaction.findMany({
      where: { participants: { some: { userId: query.userId } } },
      select: interactionSelect,
      orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    });
    const page = rows.slice(0, limit);
    return {
      items: await this.withPrivateNotes(viewerId, page),
      nextCursor: rows.length > limit ? page[page.length - 1].id : null,
    };
  }

  private async canSee(viewerId: string, row: Row): Promise<boolean> {
    if (row.createdById === viewerId) return true;
    for (const p of row.participants) {
      if (await this.access.canView(viewerId, p.user.id)) return true;
    }
    return false;
  }

  /**
   * BR-NOTE-1: private notes are read from the database only for interactions
   * the viewer created, or for everything when the viewer is an admin.
   */
  private async withPrivateNotes(
    viewerId: string,
    rows: Row[],
  ): Promise<InteractionDto[]> {
    const isAdmin = await this.roles.isAdmin(viewerId);
    const readable = await this.prisma.interaction.findMany({
      where: {
        id: { in: rows.map((r) => r.id) },
        ...(isAdmin ? {} : { createdById: viewerId }),
      },
      select: { id: true, privateNotes: true },
    });
    const notes = new Map(readable.map((r) => [r.id, r.privateNotes]));
    const now = new Date();
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      status: interactionStatus(r.startsAt, now),
      title: r.title,
      activityType: r.activityType,
      startsAt: r.startsAt.toISOString(),
      endsAt: r.endsAt?.toISOString() ?? null,
      place: r.place,
      sharedNotes: r.sharedNotes,
      privateNotes: notes.get(r.id) ?? null,
      challenges: r.challenges.map((c) => c.title),
      createdBy: r.createdBy,
      impersonator: r.impersonator,
      participants: r.participants.map((p) => p.user),
      tasks: r.tasks.map(toTaskDto),
    }));
  }
}

export function newTask(
  t: NewTaskDto,
  assigneeId: string,
  createdById: string,
) {
  return {
    title: t.title,
    dueOn: t.dueOn ? new Date(`${t.dueOn}T00:00:00Z`) : null,
    assigneeId,
    createdById,
    ...impersonation(),
  };
}
