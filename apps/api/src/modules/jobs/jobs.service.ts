import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PgBoss } from 'pg-boss';
import type { Env } from '../../config/env';

type Handler = (data: Record<string, unknown>) => Promise<void>;

interface Registration {
  name: string;
  handler: Handler;
  /** Cron in the organisation zone, for recurring jobs. */
  cron?: string;
  /** Jobs of this name run at once on this instance; 1 unless they're independent. */
  concurrency?: number;
  /** How often an idle worker looks for jobs; pg-boss's default is 2 s. */
  pollSeconds?: number;
}

/**
 * Background jobs on pg-boss (queue and cron in Postgres; docs/architecture.md "Jobs").
 * Modules register handlers in their constructors; the queue starts once the app has.
 */
@Injectable()
export class JobsService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(JobsService.name);
  private readonly registrations: Registration[] = [];
  private boss?: PgBoss;

  constructor(private readonly config: ConfigService<Env, true>) {}

  /**
   * Runs `handler` for each job sent to `name`; with `cron`, also schedules it.
   * `concurrency` lets independent jobs (one email each) run side by side;
   * `pollSeconds` picks them up sooner, since a worker takes one job per look.
   */
  register(
    name: string,
    handler: Handler,
    cron?: string,
    options: { concurrency?: number; pollSeconds?: number } = {},
  ) {
    this.registrations.push({ name, handler, cron, ...options });
  }

  /** Queues a job; runs it inline when jobs are off (tests, one-shot runs). */
  async send(name: string, data: Record<string, unknown>) {
    if (this.boss) {
      await this.boss.send(name, data, {
        retryLimit: 5,
        retryBackoff: true,
      });
      return;
    }
    await this.registrations.find((r) => r.name === name)?.handler(data);
  }

  async onApplicationBootstrap() {
    if (
      !this.config.get('JOBS_ENABLED', { infer: true }) ||
      process.env['OPENAPI_OUT']
    )
      return;
    // pg-boss is ESM-only; Function keeps the bundler from rewriting the import.
    const load = new Function('s', 'return import(s)') as (
      s: string,
    ) => Promise<typeof import('pg-boss')>;
    const { PgBoss } = await load('pg-boss');
    const boss = new PgBoss({
      connectionString: this.config.get('DATABASE_URL', { infer: true }),
    });
    boss.on('error', (error) => this.logger.error(error));
    await boss.start();
    const tz = this.config.get('ORG_TIMEZONE', { infer: true });
    for (const { name, handler, cron, concurrency, pollSeconds } of this
      .registrations) {
      await boss.createQueue(name);
      await boss.work<Record<string, unknown>>(
        name,
        {
          localConcurrency: concurrency ?? 1,
          ...(pollSeconds && { pollingIntervalSeconds: pollSeconds }),
        },
        async (jobs) => {
          for (const job of jobs) await handler(job.data ?? {});
        },
      );
      if (cron) await boss.schedule(name, cron, {}, { tz });
    }
    this.boss = boss;
  }

  async onApplicationShutdown() {
    await this.boss?.stop({ graceful: true, timeout: 5_000 });
  }
}
