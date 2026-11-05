import { Injectable } from '@nestjs/common';
import { PrismaService, type Prisma } from '@tarbya/db';
import { canSignIn, type NotificationType } from '@tarbya/shared';
import { SettingsService } from '../settings/settings.service';
import { roleFacts, RolesService } from '../users/roles.service';

/**
 * Sends notifications (BR-NTF-1…3). Users who can't sign in get none
 * (BR-AUTH-4), and nobody is notified of their own action.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roles: RolesService,
    private readonly settings: SettingsService,
  ) {}

  /** Notifies each recipient once; returns who was notified. */
  async notify(
    userIds: readonly string[],
    type: NotificationType,
    payload: Prisma.InputJsonObject,
    opts: { actorId?: string } = {},
  ): Promise<string[]> {
    const ids = [...new Set(userIds)].filter((id) => id !== opts.actorId);
    const recipients = await this.reachable(ids);
    if (!recipients.length) return [];
    await this.prisma.notification.createMany({
      data: recipients.map((userId) => ({ userId, type, payload })),
    });
    return recipients;
  }

  /** The users among `ids` who may sign in, and so may be notified. */
  async reachable(ids: readonly string[]): Promise<string[]> {
    if (!ids.length) return [];
    const [users, allowed] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          id: { in: [...ids] },
          deactivatedAt: null,
          email: { not: null },
        },
        select: { id: true, ...roleFacts },
      }),
      this.settings.get('auth.signInRoles'),
    ]);
    return users
      .filter((u) => canSignIn(this.roles.rolesFrom(u), allowed))
      .map((u) => u.id);
  }
}
