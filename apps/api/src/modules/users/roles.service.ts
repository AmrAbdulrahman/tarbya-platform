import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService, type Prisma } from '@tarbya/db';
import type { Role } from '@tarbya/shared';
import type { Env } from '../../config/env';

/** The columns and counts roles are derived from; select it alongside anything else. */
export const roleFacts = {
  email: true,
  isModerator: true,
  _count: {
    select: {
      mentoring: { where: { endedAt: null } },
      mentoredBy: { where: { endedAt: null } },
      reports: { where: { deactivatedAt: null } },
    },
  },
  groupMemberships: {
    where: { role: { not: 'MEMBER' }, group: { archivedAt: null } },
    select: { role: true },
  },
} satisfies Prisma.UserSelect;

export type RoleFacts = Prisma.UserGetPayload<{ select: typeof roleFacts }>;

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

  rolesFrom(user: RoleFacts): Role[] {
    const held: Record<Role, boolean> = {
      SUPER_ADMIN: this.isSuperAdmin(user.email),
      MODERATOR: user.isModerator,
      MANAGER: user._count.reports > 0,
      GROUP_ADMIN: user.groupMemberships.some((m) => m.role === 'ADMIN'),
      GROUP_MODERATOR: user.groupMemberships.some(
        (m) => m.role === 'MODERATOR',
      ),
      MENTOR: user._count.mentoring > 0,
      MENTEE: user._count.mentoredBy > 0,
    };
    return (Object.keys(held) as Role[]).filter((r) => held[r]);
  }

  async rolesOf(userId: string): Promise<Role[]> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: roleFacts,
    });
    return this.rolesFrom(user);
  }

  /** Super admin or moderator: may administer users, lookups and settings (BR-ADM-1). */
  async isAdmin(userId: string): Promise<boolean> {
    const user = await this.basics(userId);
    return !!user && (user.isModerator || this.isSuperAdmin(user.email));
  }

  async isSuperAdminUser(userId: string): Promise<boolean> {
    return this.isSuperAdmin((await this.basics(userId))?.email ?? null);
  }

  private basics(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, isModerator: true },
    });
  }
}
