import { Injectable } from '@nestjs/common';
import { PrismaService, type Prisma } from '@tarbya/db';
import { mentionedIds } from '@tarbya/shared';
import { forbidden } from '../../common/access';
import { AppException } from '../../common/app-exception';
import { impersonation } from '../../common/request-context';
import { MentoringAccess } from '../mentorships/mentoring-access.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { MentionAccessDto } from '../challenges/challenges.dto';
import type { CreateNoteDto, NoteDto, UpdateNoteDto } from './notes.dto';

type Visibility = 'SHARED' | 'PRIVATE';

const noteSelect = {
  id: true,
  visibility: true,
  body: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true } },
  impersonator: { select: { id: true, name: true } },
} satisfies Prisma.NoteSelect;

const toDto = (
  n: Prisma.NoteGetPayload<{ select: typeof noteSelect }>,
): NoteDto => ({
  ...n,
  createdAt: n.createdAt.toISOString(),
  updatedAt: n.updatedAt.toISOString(),
});

/**
 * Notes on a member (US-4.6, US-5.3, BR-NOTE-1, BR-NOTE-3). Shared ones reach
 * the member; private ones only those above them.
 */
@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: MentoringAccess,
    private readonly notifications: NotificationsService,
  ) {}

  /** Who may read a note of this visibility on the member (BR-NOTE-1). */
  private canRead(userId: string, subjectId: string, visibility: Visibility) {
    if (visibility === 'SHARED' && userId === subjectId)
      return Promise.resolve(true);
    return this.access.isAbove(userId, subjectId);
  }

  /** People mentioned who'll see the note are told; nobody else hears of it. */
  private async announceMentions(
    actorId: string,
    note: { id: string; subjectId: string; visibility: Visibility },
    body: string,
    already: string[] = [],
  ) {
    const subject = await this.prisma.user.findUniqueOrThrow({
      where: { id: note.subjectId },
      select: { name: true },
    });
    await this.notifications.notifyMentions(
      actorId,
      body,
      async (userId) =>
        !already.includes(userId) &&
        (await this.canRead(userId, note.subjectId, note.visibility)),
      { noteId: note.id, menteeId: note.subjectId, title: subject.name },
    );
  }

  /**
   * Of the people mentioned in a note being written, those who couldn't read
   * it: the box warns before they're left out. Asked by those who write notes.
   */
  async mentionAccess(
    askedBy: string,
    subjectId: string,
    visibility: Visibility,
    userIds: string[],
  ): Promise<MentionAccessDto> {
    if (!(await this.access.isAbove(askedBy, subjectId))) throw forbidden();
    const blocked: string[] = [];
    for (const userId of new Set(userIds)) {
      if (!(await this.canRead(userId, subjectId, visibility)))
        blocked.push(userId);
    }
    return { blocked };
  }

  /**
   * The filter is the query itself: the member gets only shared notes, anyone
   * above them (mentors, managers, admins) gets all; nobody else gets any.
   */
  async list(viewerId: string, subjectId: string): Promise<NoteDto[]> {
    let where: Prisma.NoteWhereInput;
    if (viewerId === subjectId) {
      where = { subjectId, visibility: 'SHARED' };
    } else if (await this.access.isAbove(viewerId, subjectId)) {
      where = { subjectId };
    } else {
      throw forbidden();
    }
    const rows = await this.prisma.note.findMany({
      where,
      select: noteSelect,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toDto);
  }

  async create(actorId: string, dto: CreateNoteDto): Promise<NoteDto> {
    if (!(await this.access.isAbove(actorId, dto.menteeId))) throw forbidden();
    const mentorship = await this.access.currentMentorship(
      actorId,
      dto.menteeId,
    );
    const row = await this.prisma.note.create({
      data: {
        subjectId: dto.menteeId,
        mentorshipId: mentorship?.id,
        authorId: actorId,
        visibility: dto.visibility,
        body: dto.body,
        ...impersonation(),
      },
      select: noteSelect,
    });
    await this.announceMentions(
      actorId,
      { id: row.id, subjectId: dto.menteeId, visibility: dto.visibility },
      dto.body,
    );
    return toDto(row);
  }

  /** Only the author edits; widening private to shared needs confirmation (US-4.6). */
  async update(
    actorId: string,
    id: string,
    dto: UpdateNoteDto,
  ): Promise<NoteDto> {
    const note = await this.prisma.note.findUnique({ where: { id } });
    if (!note)
      throw new AppException(404, {
        code: 'NOT_FOUND',
        title: 'Note not found',
      });
    if (note.authorId !== actorId) throw forbidden();
    if (!(await this.access.isAbove(actorId, note.subjectId)))
      throw forbidden();
    if (
      note.visibility === 'PRIVATE' &&
      dto.visibility === 'SHARED' &&
      !dto.confirmWiden
    ) {
      throw new AppException(409, {
        code: 'NOTE_WIDEN_CONFIRM',
        title:
          'Sharing a private note shows it to the mentee; confirm to continue',
      });
    }
    const row = await this.prisma.note.update({
      where: { id },
      data: { visibility: dto.visibility, body: dto.body },
      select: noteSelect,
    });
    // Only people newly mentioned by the edit are told.
    if (dto.body) {
      await this.announceMentions(
        actorId,
        { id, subjectId: note.subjectId, visibility: row.visibility },
        dto.body,
        mentionedIds(note.body),
      );
    }
    return toDto(row);
  }
}
