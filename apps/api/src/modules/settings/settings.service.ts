import { Injectable } from '@nestjs/common';
import { PrismaService } from '@tarbya/db';
import { SIGN_IN_ROLES } from '@tarbya/shared';
import { z } from 'zod';

// Each setting's shape; `.catch` is the value used when the row is missing or invalid.
const schemas = {
  'auth.signInRoles': z
    .array(z.enum(SIGN_IN_ROLES))
    .catch(['MODERATOR', 'MENTOR']),
};

type Key = keyof typeof schemas;
type Value<K extends Key> = z.infer<(typeof schemas)[K]>;

/** Reads system settings (BR-ORG-5, BR-AUTH-2). Editing them comes with US-3.6. */
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get<K extends Key>(key: K): Promise<Value<K>> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    return schemas[key].parse(row?.value) as Value<K>;
  }
}
