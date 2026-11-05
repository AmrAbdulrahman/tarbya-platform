import { Injectable } from '@nestjs/common';
import { PrismaService } from '@tarbya/db';
import { contactStatus, daysSince } from '@tarbya/shared';
import { JobsService } from '../jobs/jobs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import { ContactService } from './contact.service';

/**
 * `contact.overdue-scan`, daily: tells mentors when a mentee becomes due or
 * late for contact (BR-FU-5, BR-NTF-3), once per status since the last contact.
 */
@Injectable()
export class ContactScanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contact: ContactService,
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
    jobs: JobsService,
  ) {
    jobs.register('contact.overdue-scan', () => this.scan(), '0 9 * * *');
  }

  async scan(now = new Date()): Promise<void> {
    const [dueDays, lateDays] = await Promise.all([
      this.settings.get('contact.dueDays'),
      this.settings.get('contact.lateDays'),
    ]);
    const mentorships = await this.prisma.mentorship.findMany({
      where: { endedAt: null, mentee: { deactivatedAt: null } },
      select: {
        id: true,
        mentorId: true,
        startedAt: true,
        mentee: { select: { id: true, name: true } },
      },
    });
    const mentorIds = [...new Set(mentorships.map((m) => m.mentorId))];
    for (const mentorId of mentorIds) {
      const last = await this.contact.lastContacts(mentorId);
      for (const m of mentorships.filter((x) => x.mentorId === mentorId)) {
        const since = last.get(m.id)?.at ?? m.startedAt;
        const status = contactStatus(since, now, { dueDays, lateDays });
        if (status === 'REGULAR') continue;
        const type = status === 'LATE' ? 'CONTACT_LATE' : 'CONTACT_DUE';
        const already = await this.prisma.notification.count({
          where: {
            userId: mentorId,
            type,
            createdAt: { gte: since },
            payload: { path: ['menteeId'], equals: m.mentee.id },
          },
        });
        if (already) continue;
        await this.notifications.notify([mentorId], type, {
          menteeId: m.mentee.id,
          menteeName: m.mentee.name,
          days: daysSince(since, now),
        });
      }
    }
  }
}
