import { Injectable } from '@nestjs/common';
import { PrismaService, type Prisma } from '@tarbya/db';
import { forbidden } from '../../common/access';
import { AppException } from '../../common/app-exception';
import { impersonation } from '../../common/request-context';
import { HierarchyService } from '../hierarchy/hierarchy.service';
import { MentoringAccess } from '../mentorships/mentoring-access.service';
import { roleFacts, RolesService } from '../users/roles.service';
import type { AdminNoteDto, ProfileDto } from './profiles.dto';

const noteSelect = {
  id: true,
  body: true,
  createdAt: true,
  updatedAt: true,
  authorId: true,
  author: { select: { id: true, name: true } },
  impersonator: { select: { id: true, name: true } },
} satisfies Prisma.AdminNoteSelect;

const notFound = () =>
  new AppException(404, { code: 'NOT_FOUND', title: 'Not found' });

/** Member profiles and the admin notes on them. */
@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roles: RolesService,
    private readonly mentoring: MentoringAccess,
    private readonly hierarchy: HierarchyService,
  ) {}

  /** Everyone above the user in the management chain, their current mentor, and admins. */
  async isResponsibleFor(
    viewerId: string,
    subjectId: string,
  ): Promise<boolean> {
    if (viewerId === subjectId) return false;
    if (await this.roles.isAdmin(viewerId)) return true;
    if (await this.mentoring.currentMentorship(viewerId, subjectId))
      return true;
    return this.hierarchy.isInSubtree(this.prisma, viewerId, subjectId);
  }

  async get(viewerId: string, id: string): Promise<ProfileDto> {
    const responsible = await this.isResponsibleFor(viewerId, id);
    if (viewerId !== id && !responsible) throw forbidden();
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        phone: true,
        deactivatedAt: true,
        manager: { select: { id: true, name: true } },
        mentoredBy: {
          where: { endedAt: null },
          select: { mentor: { select: { id: true, name: true } } },
        },
        ...roleFacts,
      },
    });
    if (!user) throw notFound();
    const [canSeeMentoring, isAdmin, isMentor] = await Promise.all([
      this.mentoring.canView(viewerId, id),
      this.roles.isAdmin(viewerId),
      this.mentoring.currentMentorship(viewerId, id).then(Boolean),
    ]);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      roles: this.roles.rolesFrom(user),
      manager: user.manager,
      mentor: user.mentoredBy[0]?.mentor ?? null,
      deactivatedAt: user.deactivatedAt?.toISOString() ?? null,
      canSeeAdminNotes: responsible,
      canSeeMentoring,
      canManageMentoring: isAdmin || isMentor,
      isMentor,
    };
  }

  async notes(viewerId: string, subjectId: string): Promise<AdminNoteDto[]> {
    await this.assertResponsible(viewerId, subjectId);
    const rows = await this.prisma.adminNote.findMany({
      where: { subjectId },
      select: noteSelect,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((n) => toDto(n, viewerId));
  }

  async addNote(
    viewerId: string,
    subjectId: string,
    body: string,
  ): Promise<AdminNoteDto> {
    await this.assertResponsible(viewerId, subjectId);
    if (!(await this.prisma.user.count({ where: { id: subjectId } })))
      throw notFound();
    const row = await this.prisma.adminNote.create({
      data: { subjectId, authorId: viewerId, body, ...impersonation() },
      select: noteSelect,
    });
    return toDto(row, viewerId);
  }

  /** The author edits, while they're still responsible for the user. */
  async editNote(
    viewerId: string,
    id: string,
    body: string,
  ): Promise<AdminNoteDto> {
    const note = await this.prisma.adminNote.findUnique({ where: { id } });
    if (!note) throw notFound();
    if (note.authorId !== viewerId) throw forbidden();
    await this.assertResponsible(viewerId, note.subjectId);
    const row = await this.prisma.adminNote.update({
      where: { id },
      data: { body },
      select: noteSelect,
    });
    return toDto(row, viewerId);
  }

  private async assertResponsible(viewerId: string, subjectId: string) {
    if (!(await this.isResponsibleFor(viewerId, subjectId))) throw forbidden();
  }
}

function toDto(
  n: Prisma.AdminNoteGetPayload<{ select: typeof noteSelect }>,
  viewerId: string,
): AdminNoteDto {
  return {
    id: n.id,
    body: n.body,
    author: n.author,
    impersonator: n.impersonator,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
    canEdit: n.authorId === viewerId,
  };
}
