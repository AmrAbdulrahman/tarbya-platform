import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@tarbya/db';
import type { Role } from '@tarbya/shared';
import type { Env } from '../../config/env';

/** Derives a user's roles from their relationships (BR-USR-5). */
@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  isSuperAdmin(email: string | null): boolean {
    return (
      !!email &&
      email.toLowerCase() ===
        this.config.get('SUPER_ADMIN_EMAIL', { infer: true }).toLowerCase()
    );
  }

  async rolesOf(userId: string): Promise<Role[]> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        email: true,
        isModerator: true,
        _count: {
          select: {
            mentoring: { where: { endedAt: null } },
            mentoredBy: { where: { endedAt: null } },
            reports: { where: { deactivatedAt: null } },
          },
        },
      },
    });
    // Group roles join this list with the groups module (build order step 8).
    const held: Record<Role, boolean> = {
      SUPER_ADMIN: this.isSuperAdmin(user.email),
      MODERATOR: user.isModerator,
      MANAGER: user._count.reports > 0,
      GROUP_ADMIN: false,
      GROUP_MODERATOR: false,
      MENTOR: user._count.mentoring > 0,
      MENTEE: user._count.mentoredBy > 0,
    };
    return (Object.keys(held) as Role[]).filter((r) => held[r]);
  }
}
