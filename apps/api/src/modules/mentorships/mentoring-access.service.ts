import { Injectable } from '@nestjs/common';
import { PrismaService } from '@tarbya/db';
import { forbidden } from '../../common/access';
import { AppException } from '../../common/app-exception';
import { RolesService } from '../users/roles.service';

/** Who may see or act on a mentee's follow-ups, tasks and notes. */
@Injectable()
export class MentoringAccess {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roles: RolesService,
  ) {}

  /** The active mentorship where `mentorId` mentors `menteeId`, if there is one. */
  currentMentorship(mentorId: string, menteeId: string) {
    return this.prisma.mentorship.findFirst({
      where: { mentorId, menteeId, endedAt: null },
    });
  }

  async assertCurrentMentor(mentorId: string, menteeId: string) {
    const mentorship = await this.currentMentorship(mentorId, menteeId);
    if (!mentorship) {
      throw new AppException(403, {
        code: 'NOT_YOUR_MENTEE',
        title: 'You are not this member’s mentor',
      });
    }
    return mentorship;
  }

  /** The mentee themself, their current mentor, or an admin. */
  async canView(viewerId: string, menteeId: string): Promise<boolean> {
    if (viewerId === menteeId) return true;
    if (await this.currentMentorship(viewerId, menteeId)) return true;
    return this.roles.isAdmin(viewerId);
  }

  async assertCanView(viewerId: string, menteeId: string) {
    if (!(await this.canView(viewerId, menteeId))) throw forbidden();
  }

  /** Mentors log activities (BR-FU-2); admins may too. */
  async assertMentorOrAdmin(userId: string) {
    const mentees = await this.prisma.mentorship.count({
      where: { mentorId: userId, endedAt: null },
    });
    if (!mentees && !(await this.roles.isAdmin(userId))) throw forbidden();
  }
}
