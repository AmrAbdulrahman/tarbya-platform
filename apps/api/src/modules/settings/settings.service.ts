import { Injectable } from '@nestjs/common';
import { PrismaService, type Prisma } from '@tarbya/db';
import {
  DEFAULT_SETTINGS,
  SIGN_IN_ROLES,
  type SettingKey,
  type Settings,
} from '@tarbya/shared';
import { z } from 'zod';
import { AppException } from '../../common/app-exception';
import { AuditService } from '../audit/audit.service';

// What a stored value must look like; anything else falls back to the default.
const schemas: { [K in SettingKey]: z.ZodType<Settings[K]> } = {
  'auth.signInRoles': z.array(z.enum(SIGN_IN_ROLES)),
  'contact.dueDays': z.number().int().positive(),
  'contact.lateDays': z.number().int().positive(),
  'gatherings.rsvpRequestHours': z.number().int().positive(),
  'gatherings.reminderHours': z.number().int().positive(),
  'trackables.trendWindow': z.number().int().positive(),
  'trackables.trendSteadyBand': z.number().min(0),
};

/** System settings (BR-ORG-5, BR-AUTH-2, US-3.6). */
@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get<K extends SettingKey>(key: K): Promise<Settings[K]> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    return this.parse(key, row?.value);
  }

  async all(): Promise<Settings> {
    const rows = await this.prisma.setting.findMany();
    const stored = new Map(rows.map((r) => [r.key, r.value]));
    const out = { ...DEFAULT_SETTINGS };
    for (const key of Object.keys(DEFAULT_SETTINGS) as SettingKey[]) {
      (out as Record<SettingKey, unknown>)[key] = this.parse(
        key,
        stored.get(key),
      );
    }
    return out;
  }

  /** Saves the changed keys and audits each one (BR-ADM-4). */
  async update(actorId: string, changes: Partial<Settings>): Promise<Settings> {
    const current = await this.all();
    const next = { ...current, ...changes };
    if (next['contact.lateDays'] <= next['contact.dueDays']) {
      throw new AppException(400, {
        code: 'VALIDATION_FAILED',
        title: 'Late must be more days than due',
        errors: { contactLateDays: ['must be greater than contactDueDays'] },
      });
    }
    await this.prisma.$transaction(async (tx) => {
      for (const key of Object.keys(changes) as SettingKey[]) {
        const before = current[key];
        const after = changes[key];
        if (
          after === undefined ||
          JSON.stringify(before) === JSON.stringify(after)
        )
          continue;
        const value = after as Prisma.InputJsonValue;
        await tx.setting.upsert({
          where: { key },
          create: { key, value },
          update: { value },
        });
        await this.audit.record(
          {
            actorId,
            action: 'settings.update',
            entity: 'Setting',
            entityId: key,
            diff: { value: [before, after] },
          },
          tx,
        );
      }
    });
    return this.all();
  }

  private parse<K extends SettingKey>(key: K, value: unknown): Settings[K] {
    const parsed = schemas[key].safeParse(value);
    return parsed.success ? parsed.data : DEFAULT_SETTINGS[key];
  }
}
