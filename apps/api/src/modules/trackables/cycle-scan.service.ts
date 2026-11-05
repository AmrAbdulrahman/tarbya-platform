import { Injectable } from '@nestjs/common';
import { PrismaService } from '@tarbya/db';
import { JobsService } from '../jobs/jobs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TrackablesService } from './trackables.service';

/**
 * `trackables.cycle-due`, each evening: reminds mentees of cycles waiting to be
 * logged (BR-NTF-3, BR-TRK-4), one notice per mentee per day.
 */
@Injectable()
export class CycleScanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trackables: TrackablesService,
    private readonly notifications: NotificationsService,
    jobs: JobsService,
  ) {
    jobs.register('trackables.cycle-due', () => this.scan(), '0 19 * * *');
  }

  async scan(): Promise<void> {
    const mentees = await this.prisma.trackable.findMany({
      where: { archivedAt: null, mentee: { deactivatedAt: null } },
      select: { menteeId: true },
      distinct: ['menteeId'],
    });
    // Only those who can sign in get notices; skip the work for the rest.
    const reachable = await this.notifications.reachable(
      mentees.map((m) => m.menteeId),
    );
    const active = await this.trackables.activeOf(reachable);
    for (const menteeId of reachable) {
      const waiting = active.filter(
        (t) => t.menteeId === menteeId && t.openCycles.length > 0,
      );
      if (!waiting.length) continue;
      await this.notifications.notify([menteeId], 'CYCLE_WAITING', {
        count: waiting.reduce((n, t) => n + t.openCycles.length, 0),
        trackableId: waiting[0].id,
        name: waiting[0].name,
      });
    }
  }
}
