import { Injectable } from '@nestjs/common';
import { PrismaService, type Prisma } from '@tarbya/db';
import { forbidden } from '../../common/access';
import { AppException } from '../../common/app-exception';
import { MentoringAccess } from '../mentorships/mentoring-access.service';
import { RolesService } from '../users/roles.service';
import type { CreateNoteDto, NoteDto, UpdateNoteDto } from './notes.dto';

const noteSelect = {
  id: true,
  visibility: true,
  body: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true } },
} satisfies Prisma.NoteSelect;

const toDto = (
  n: Prisma.NoteGetPayload<{ select: typeof noteSelect }>,
): NoteDto => ({
  ...n,
  createdAt: n.createdAt.toISOString(),
  updatedAt: n.updatedAt.toISOString(),
});

/** Notes on a mentee (US-4.6, US-5.3, BR-NOTE-1). */
@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: MentoringAccess,
    private readonly roles: RolesService,
  ) {}

  /**
   * The filter is the query itself: the mentee gets only shared notes, a mentor
   * gets the notes of their own mentorships with the mentee, admins get all.
   */
  async list(viewerId: string, menteeId: string): Promise<NoteDto[]> {
    let where: Prisma.NoteWhereInput;
    if (viewerId === menteeId) {
      where = { mentorship: { menteeId }, visibility: 'SHARED' };
    } else if (await this.roles.isAdmin(viewerId)) {
      where = { mentorship: { menteeId } };
    } else if (await this.access.currentMentorship(viewerId, menteeId)) {
      where = { mentorship: { menteeId, mentorId: viewerId } };
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
    const mentorship = await this.access.assertCurrentMentor(
      actorId,
      dto.menteeId,
    );
    return toDto(
      await this.prisma.note.create({
        data: {
          mentorshipId: mentorship.id,
          authorId: actorId,
          visibility: dto.visibility,
          body: dto.body,
        },
        select: noteSelect,
      }),
    );
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
    return toDto(
      await this.prisma.note.update({
        where: { id },
        data: { visibility: dto.visibility, body: dto.body },
        select: noteSelect,
      }),
    );
  }
}
