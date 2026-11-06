import { Injectable } from '@nestjs/common';
import { PrismaService } from '@tarbya/db';
import { forbidden } from '../../common/access';
import { AppException } from '../../common/app-exception';
import { MentoringAccess } from '../mentorships/mentoring-access.service';
import { roleFacts, RolesService } from '../users/roles.service';
import type { ProfileDto } from './profiles.dto';

const notFound = () =>
  new AppException(404, { code: 'NOT_FOUND', title: 'Not found' });

/** Member profiles. */
@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roles: RolesService,
    private readonly mentoring: MentoringAccess,
  ) {}

  async get(viewerId: string, id: string): Promise<ProfileDto> {
    const responsible = await this.mentoring.isAbove(viewerId, id);
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
      canWriteNotes: responsible,
      canSeeMentoring,
      canManageMentoring: isAdmin || isMentor,
      isMentor,
    };
  }
}
