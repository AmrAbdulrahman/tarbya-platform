import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService, type Prisma } from '@tarbya/db';
import {
  canSignIn,
  deliveryFor,
  isNotificationType,
  MANDATORY_NOTIFICATIONS,
  mentionedIds,
  plainMentions,
  NOTIFICATION_CATEGORY,
  NOTIFICATION_TYPES,
  notificationLink,
  type NotificationCategory,
  type NotificationType,
} from '@tarbya/shared';
import type { Env } from '../../config/env';
import { AppException } from '../../common/app-exception';
import { EventsService } from '../events/events.service';
import { JobsService } from '../jobs/jobs.service';
import { MailService } from '../mail/mail.service';
import { SettingsService } from '../settings/settings.service';
import { roleFacts, RolesService } from '../users/roles.service';
import { notificationMail } from './notification-mail';
import type {
  NotificationDto,
  NotificationPageDto,
  NotificationsQuery,
  PreferenceChangeDto,
  PreferenceDto,
} from './notifications.dto';

interface EmailJob {
  userId: string;
  type: NotificationType;
  payload: Record<string, unknown>;
}

const typesIn = (category: NotificationCategory) =>
  NOTIFICATION_TYPES.filter((t) => NOTIFICATION_CATEGORY[t] === category);

/**
 * Sends notifications in-app and by email, as each user chose (BR-NTF-1…3).
 * Users who can't sign in get none (BR-AUTH-4), and nobody is notified of
 * their own action.
 */
@Injectable()
export class NotificationsService {
  private readonly appUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly roles: RolesService,
    private readonly settings: SettingsService,
    private readonly events: EventsService,
    private readonly jobs: JobsService,
    private readonly mail: MailService,
    config: ConfigService<Env, true>,
  ) {
    this.appUrl = config.get('APP_URL', { infer: true }).replace(/\/$/, '');
    // Each email stands alone, so several go out at once, soon after they're
    // queued: a group's reminders shouldn't trickle out one every 2 s.
    jobs.register(
      'email.send',
      (data) => this.sendEmail(data as unknown as EmailJob),
      undefined,
      { concurrency: 5, pollSeconds: 0.5 },
    );
  }

  /** Notifies each recipient once, on the channels they chose; returns who was notified. */
  async notify(
    userIds: readonly string[],
    type: NotificationType,
    payload: Prisma.InputJsonObject,
    opts: { actorId?: string } = {},
  ): Promise<string[]> {
    const ids = [...new Set(userIds)].filter((id) => id !== opts.actorId);
    const recipients = await this.reachable(ids);
    if (!recipients.length) return [];
    const choices = await this.prisma.notificationPreference.findMany({
      where: { userId: { in: recipients }, type },
    });
    const choiceOf = new Map(choices.map((c) => [c.userId, c]));
    const delivery = recipients.map((userId) => ({
      userId,
      ...deliveryFor(type, choiceOf.get(userId)),
    }));
    const inApp = delivery.filter((d) => d.inApp).map((d) => d.userId);
    if (inApp.length) {
      await this.prisma.notification.createMany({
        data: inApp.map((userId) => ({ userId, type, payload })),
      });
      this.events.publish(inApp, { type: 'notification' });
    }
    for (const d of delivery.filter((x) => x.email)) {
      await this.jobs.send('email.send', {
        userId: d.userId,
        type,
        payload: payload as Record<string, unknown>,
      });
    }
    return recipients;
  }

  /**
   * Tells the people `body` mentions, except the author and those `canSee`
   * turns away (they couldn't open what they're mentioned in). `payload` says
   * where: a `title`, and the ids its link needs. Returns who was mentioned and told.
   */
  async notifyMentions(
    actorId: string,
    body: string,
    canSee: (userId: string) => Promise<boolean>,
    payload: Prisma.InputJsonObject,
  ): Promise<string[]> {
    const ids: string[] = [];
    for (const id of mentionedIds(body)) {
      if (id !== actorId && (await canSee(id))) ids.push(id);
    }
    if (!ids.length) return [];
    return this.notify(
      ids,
      'MENTIONED',
      {
        ...payload,
        byName: await this.nameOf(actorId),
        preview: plainMentions(body).slice(0, 200),
      },
      { actorId },
    );
  }

  /** The name a notification shows for whoever acted. */
  async nameOf(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    return user?.name ?? '';
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

  /** The `email.send` job: one email, in the recipient's language (US-7.2). */
  private async sendEmail(job: EmailJob) {
    const user = await this.prisma.user.findUnique({
      where: { id: job.userId },
      select: { email: true, locale: true, deactivatedAt: true },
    });
    if (!user?.email || user.deactivatedAt) return;
    const path = notificationLink(job.type, job.payload, job.userId);
    await this.mail.send(
      notificationMail({
        to: user.email,
        locale: user.locale,
        type: job.type,
        payload: job.payload,
        recipientId: job.userId,
        url: `${this.appUrl}${path}`,
      }),
    );
  }

  // ── The notification centre (US-7.1) ────────────────────────────────

  async list(
    userId: string,
    query: NotificationsQuery,
  ): Promise<NotificationPageDto> {
    const limit = query.limit ?? 20;
    const filter = query.filter ?? 'all';
    const rows = await this.prisma.notification.findMany({
      where: {
        userId,
        ...(filter === 'unread' && { readAt: null }),
        ...(filter !== 'all' &&
          filter !== 'unread' && { type: { in: typesIn(filter) } }),
        ...(query.before && { createdAt: { lt: new Date(query.before) } }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    return {
      items: page.flatMap((r) => {
        if (!isNotificationType(r.type)) return [];
        const payload = (r.payload ?? {}) as Record<string, unknown>;
        return [
          {
            id: r.id,
            type: r.type,
            category: NOTIFICATION_CATEGORY[r.type],
            payload,
            link: notificationLink(r.type, payload, userId),
            readAt: r.readAt?.toISOString() ?? null,
            createdAt: r.createdAt.toISOString(),
          } satisfies NotificationDto,
        ];
      }),
      nextCursor:
        rows.length > limit
          ? page[page.length - 1].createdAt.toISOString()
          : null,
    };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (!count) {
      const exists = await this.prisma.notification.count({
        where: { id, userId },
      });
      if (!exists)
        throw new AppException(404, {
          code: 'NOT_FOUND',
          title: 'Notification not found',
        });
    }
    this.events.publish([userId], { type: 'notification' });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    this.events.publish([userId], { type: 'notification' });
  }

  // ── Preferences (US-2.4) ────────────────────────────────────────────

  async preferences(userId: string): Promise<PreferenceDto[]> {
    const rows = await this.prisma.notificationPreference.findMany({
      where: { userId },
    });
    const byType = new Map(rows.map((r) => [r.type, r]));
    return NOTIFICATION_TYPES.map((type) => ({
      type,
      ...deliveryFor(type, byType.get(type)),
      mandatory: MANDATORY_NOTIFICATIONS.includes(type),
    }));
  }

  async updatePreferences(
    userId: string,
    changes: PreferenceChangeDto[],
  ): Promise<PreferenceDto[]> {
    await this.prisma.$transaction(
      changes.map((c) => {
        // A mandatory type can't be switched off in-app.
        const inApp = MANDATORY_NOTIFICATIONS.includes(c.type) || c.inApp;
        return this.prisma.notificationPreference.upsert({
          where: { userId_type: { userId, type: c.type } },
          create: { userId, type: c.type, inApp, email: c.email },
          update: { inApp, email: c.email },
        });
      }),
    );
    return this.preferences(userId);
  }
}
