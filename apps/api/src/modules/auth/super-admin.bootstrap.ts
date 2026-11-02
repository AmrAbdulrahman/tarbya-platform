import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@tarbya/db';
import * as argon2 from 'argon2';
import type { Env } from '../../config/env';
import { normalizeEmail } from './tokens';

/**
 * The super admin comes from the environment (BR-USR-3): make sure the user exists,
 * and give it SUPER_ADMIN_PASSWORD if it has no password yet (first boot only).
 */
@Injectable()
export class SuperAdminBootstrap implements OnApplicationBootstrap {
  private readonly logger = new Logger(SuperAdminBootstrap.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onApplicationBootstrap() {
    const email = normalizeEmail(
      this.config.get('SUPER_ADMIN_EMAIL', { infer: true }),
    );
    const password = this.config.get('SUPER_ADMIN_PASSWORD', { infer: true });

    const user = await this.prisma.user.upsert({
      where: { email },
      create: {
        email,
        name: this.config.get('SUPER_ADMIN_NAME', { infer: true }),
      },
      update: { deactivatedAt: null },
      include: { password: true },
    });
    if (!user.password && password) {
      await this.prisma.passwordCredential.create({
        data: { userId: user.id, hash: await argon2.hash(password) },
      });
      this.logger.log(`Set the first password for super admin ${email}`);
    }
  }
}
