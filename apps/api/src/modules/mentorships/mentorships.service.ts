import { Injectable } from '@nestjs/common';
import { PrismaService, type Prisma } from '@tarbya/db';
import { contactStatus, daysSince } from '@tarbya/shared';
import { AppException } from '../../common/app-exception';
import { AuditService } from '../audit/audit.service';
import { HierarchyService } from '../hierarchy/hierarchy.service';
import { SettingsService } from '../settings/settings.service';
import { ContactService } from './contact.service';
import type {
  AssignMentorshipDto,
  MentorshipDto,
  MyMentoringDto,
} from './mentorships.dto';

const mentorshipSelect = {
  id: true,
  startedAt: true,
  endedAt: true,
  mentor: {
    select: {
      id: true,
      name: true,
      manager: { select: { id: true, name: true } },
    },
  },
  mentee: { select: { id: true, name: true } },
} satisfies Prisma.MentorshipSelect;

type Row = Prisma.MentorshipGetPayload<{ select: typeof mentorshipSelect }>;

const toDto = (row: Row): MentorshipDto => ({
  id: row.id,
  mentor: row.mentor,
  mentee: row.mentee,
  startedAt: row.startedAt.toISOString(),
  endedAt: row.endedAt?.toISOString() ?? null,
});

/** Mentor ↔ mentee assignments (US-3.3, BR-MEN-1…4). */
@Injectable()
export class MentorshipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly hierarchy: HierarchyService,
    private readonly contact: ContactService,
    private readonly settings: SettingsService,
  ) {}

  /** Every active mentorship; the admin screen draws the tree from it. */
  async active(): Promise<MentorshipDto[]> {
    const rows = await this.prisma.mentorship.findMany({
      where: { endedAt: null },
      select: mentorshipSelect,
      orderBy: { startedAt: 'asc' },
    });
    return rows.map(toDto);
  }

  async assign(
    actorId: string,
    dto: AssignMentorshipDto,
  ): Promise<MentorshipDto> {
    const { mentorId, menteeId } = dto;
    if (mentorId === menteeId) throw cycle();

    const id = await this.prisma.$transaction(async (tx) => {
      // One mentoring change at a time, so two assignments can't form a loop between them.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('mentoring'))`;
      const people = await tx.user.findMany({
        where: { id: { in: [mentorId, menteeId] } },
        select: { id: true, deactivatedAt: true },
      });
      if (people.length !== 2 || people.some((p) => p.deactivatedAt)) {
        throw new AppException(409, {
          code: 'USER_INACTIVE',
          title: 'Both people must be active users',
        });
      }
      // BR-MEN-3: nobody mentors someone above them in their own chain.
      if (await this.hierarchy.isMentorAbove(tx, mentorId, menteeId))
        throw cycle();

      const current = await tx.mentorship.findFirst({
        where: { menteeId, endedAt: null },
        select: mentorshipSelect,
      });
      if (current?.mentor.id === mentorId) return current.id;
      if (current) {
        if (!dto.replace) {
          throw new AppException(409, {
            code: 'MENTEE_HAS_MENTOR',
            title: 'This member already has a mentor',
            detail: current.mentor.name,
          });
        }
        await this.endIn(tx, actorId, current.id);
      }
      const created = await tx.mentorship.create({
        data: { mentorId, menteeId },
      });
      await this.audit.record(
        {
          actorId,
          action: 'mentorship.start',
          entity: 'Mentorship',
          entityId: created.id,
          diff: { mentorId: [null, mentorId], menteeId: [null, menteeId] },
        },
        tx,
      );
      return created.id;
    });

    return toDto(
      await this.prisma.mentorship.findUniqueOrThrow({
        where: { id },
        select: mentorshipSelect,
      }),
    );
  }

  /** BR-MEN-4: ending keeps the follow-ups and notes attached to the mentorship. */
  async end(actorId: string, id: string): Promise<MentorshipDto> {
    await this.prisma.$transaction(async (tx) => {
      const row = await tx.mentorship.findUnique({ where: { id } });
      if (!row)
        throw new AppException(404, {
          code: 'NOT_FOUND',
          title: 'Mentorship not found',
        });
      if (!row.endedAt) await this.endIn(tx, actorId, id);
    });
    return toDto(
      await this.prisma.mentorship.findUniqueOrThrow({
        where: { id },
        select: mentorshipSelect,
      }),
    );
  }

  /** The signed-in user's mentor and mentees, with last contact (BR-FU-5). */
  async mine(userId: string): Promise<MyMentoringDto> {
    const [asMentee, asMentor, lastContacts, dueDays, lateDays] =
      await Promise.all([
        this.prisma.mentorship.findFirst({
          where: { menteeId: userId, endedAt: null },
          select: { mentor: { select: { id: true, name: true } } },
        }),
        this.prisma.mentorship.findMany({
          where: { mentorId: userId, endedAt: null },
          select: mentorshipSelect,
          orderBy: { mentee: { name: 'asc' } },
        }),
        this.contact.lastContacts(userId),
        this.settings.get('contact.dueDays'),
        this.settings.get('contact.lateDays'),
      ]);
    const openTasks = await this.prisma.task.groupBy({
      by: ['assigneeId'],
      where: {
        assigneeId: { in: asMentor.map((m) => m.mentee.id) },
        doneAt: null,
      },
      _count: true,
    });
    const tasksOf = new Map(openTasks.map((t) => [t.assigneeId, t._count]));
    const now = new Date();

    return {
      mentor: asMentee?.mentor ?? null,
      mentees: asMentor.map((m) => {
        const last = lastContacts.get(m.id) ?? null;
        const since = last?.at ?? m.startedAt;
        return {
          mentorshipId: m.id,
          mentee: m.mentee,
          startedAt: m.startedAt.toISOString(),
          lastContactAt: last?.at.toISOString() ?? null,
          lastContactKind: last?.kind ?? null,
          contactStatus: contactStatus(since, now, { dueDays, lateDays }),
          daysSinceContact: daysSince(since, now),
          openTasks: tasksOf.get(m.mentee.id) ?? 0,
        };
      }),
    };
  }

  private async endIn(
    tx: Prisma.TransactionClient,
    actorId: string,
    id: string,
  ) {
    await tx.mentorship.update({
      where: { id },
      data: { endedAt: new Date() },
    });
    await this.audit.record(
      { actorId, action: 'mentorship.end', entity: 'Mentorship', entityId: id },
      tx,
    );
  }
}

const cycle = () =>
  new AppException(409, {
    code: 'MENTORSHIP_CYCLE',
    title: 'That would put someone under their own mentee',
  });
