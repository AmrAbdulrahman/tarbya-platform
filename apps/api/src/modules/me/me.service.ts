import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@tarbya/db';
import * as argon2 from 'argon2';
import { isEmail } from 'class-validator';
import { AppException } from '../../common/app-exception';
import type { Env } from '../../config/env';
import { contactCodeMail } from '../auth/mail-templates';
import { SessionsService } from '../auth/sessions.service';
import {
  CODE_MAX_ATTEMPTS,
  CODE_MAX_PER_WINDOW,
  CODE_TTL_MINUTES,
  CODE_WINDOW_MINUTES,
  hashCode,
  newCode,
  normalizeEmail,
  safeEqual,
} from '../auth/tokens';
import { AvatarsService } from '../files/avatars.service';
import { MailService } from '../mail/mail.service';
import { RolesService } from '../users/roles.service';
import { normalizePhone } from '../users/users.service';
import type { MyProfileDto, UpdateMyProfileDto } from './me.dto';

/** Without a password, setting one needs a sign-in this recent (US-2.3: "a fresh one-time code"). */
const FRESH_SIGN_IN_MINUTES = 15;
const PHONE = /^\+?[0-9][0-9 ()-]{5,19}$/;

const invalidCode = () =>
  new AppException(401, {
    code: 'AUTH_CODE_INVALID',
    title: 'The code is wrong or has expired',
  });

/** The signed-in user's own profile (E2). */
@Injectable()
export class MeService {
  private readonly logger = new Logger(MeService.name);
  private readonly codeKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
    private readonly roles: RolesService,
    private readonly mail: MailService,
    config: ConfigService<Env, true>,
  ) {
    this.codeKey = config.get('JWT_SECRET', { infer: true });
  }

  async profile(userId: string): Promise<MyProfileDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { password: { select: { updatedAt: true } } },
    });
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      locale: user.locale,
      calendar: user.calendar,
      avatarUrl: AvatarsService.url(user.id, user.avatarFileId),
      hasPassword: !!user.password,
      passwordChangedAt: user.password?.updatedAt.toISOString() ?? null,
    };
  }

  async update(userId: string, dto: UpdateMyProfileDto): Promise<MyProfileDto> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name, locale: dto.locale, calendar: dto.calendar },
    });
    return this.profile(userId);
  }

  /**
   * US-2.2: checks the value is free, then emails a code. A new email gets the
   * code itself; a new phone is confirmed through the current email (no SMS in v1).
   */
  async requestContactChange(
    userId: string,
    kind: 'EMAIL' | 'PHONE',
    raw: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    let value: string;
    if (kind === 'EMAIL') {
      if (!isEmail(raw)) throw invalid('value', 'must be an email');
      value = normalizeEmail(raw);
      if (this.roles.isSuperAdmin(user.email)) {
        throw new AppException(409, {
          code: 'SUPER_ADMIN_LOCKED',
          title: 'The super admin email is set by the environment',
        });
      }
    } else {
      if (!PHONE.test(raw)) throw invalid('value', 'must be a phone number');
      value = normalizePhone(raw);
    }
    if (value === (kind === 'EMAIL' ? user.email : user.phone)) {
      throw invalid('value', 'is already yours');
    }
    const taken = await this.prisma.user.count({
      where: {
        id: { not: userId },
        ...(kind === 'EMAIL' ? { email: value } : { phone: value }),
      },
    });
    if (taken) {
      throw new AppException(409, {
        code: kind === 'EMAIL' ? 'USER_EMAIL_TAKEN' : 'USER_PHONE_TAKEN',
        title: 'Another user has this',
      });
    }
    const to = kind === 'EMAIL' ? value : user.email;
    if (!to) throw invalid('value', 'needs an email on the account to confirm');

    const since = new Date(Date.now() - CODE_WINDOW_MINUTES * 60_000);
    const recent = await this.prisma.contactChange.count({
      where: { userId, kind, createdAt: { gte: since } },
    });
    if (recent >= CODE_MAX_PER_WINDOW) {
      throw new AppException(429, {
        code: 'RATE_LIMITED',
        title: 'Too many codes; wait a few minutes',
      });
    }

    const code = newCode();
    await this.prisma.$transaction([
      this.prisma.contactChange.updateMany({
        where: { userId, kind, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.contactChange.create({
        data: {
          userId,
          kind,
          value,
          codeHash: hashCode(code, this.codeKey),
          expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60_000),
        },
      }),
    ]);
    try {
      await this.mail.send(contactCodeMail(to, code, user.locale, kind));
    } catch (error) {
      this.logger.error(`Could not send a contact code: ${String(error)}`);
    }
  }

  async confirmContactChange(
    userId: string,
    kind: 'EMAIL' | 'PHONE',
    code: string,
  ): Promise<MyProfileDto> {
    const pending = await this.prisma.contactChange.findFirst({
      where: {
        userId,
        kind,
        usedAt: null,
        expiresAt: { gt: new Date() },
        attempts: { lt: CODE_MAX_ATTEMPTS },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!pending) throw invalidCode();
    if (!safeEqual(hashCode(code, this.codeKey), pending.codeHash)) {
      await this.prisma.contactChange.update({
        where: { id: pending.id },
        data: { attempts: { increment: 1 } },
      });
      throw invalidCode();
    }
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.contactChange.updateMany({
        where: { id: pending.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (!count) throw invalidCode();
      // Someone may have taken it since the code was sent.
      const taken = await tx.user.count({
        where: {
          id: { not: userId },
          ...(kind === 'EMAIL'
            ? { email: pending.value }
            : { phone: pending.value }),
        },
      });
      if (taken) {
        throw new AppException(409, {
          code: kind === 'EMAIL' ? 'USER_EMAIL_TAKEN' : 'USER_PHONE_TAKEN',
          title: 'Another user has this',
        });
      }
      await tx.user.update({
        where: { id: userId },
        data:
          kind === 'EMAIL'
            ? { email: pending.value }
            : { phone: pending.value },
      });
    });
    return this.profile(userId);
  }

  /** US-2.3: other sessions are signed out; this one stays. */
  async changePassword(
    userId: string,
    sessionId: string,
    current: string | undefined,
    next: string,
  ): Promise<void> {
    const credential = await this.prisma.passwordCredential.findUnique({
      where: { userId },
    });
    if (credential) {
      const ok = current
        ? await argon2.verify(credential.hash, current).catch(() => false)
        : false;
      if (!ok) {
        throw new AppException(401, {
          code: 'AUTH_INVALID_CREDENTIALS',
          title: 'The current password is wrong',
        });
      }
    } else {
      const session = await this.prisma.session.findUniqueOrThrow({
        where: { id: sessionId },
      });
      if (
        Date.now() - session.createdAt.getTime() >
        FRESH_SIGN_IN_MINUTES * 60_000
      ) {
        throw new AppException(403, {
          code: 'PASSWORD_REAUTH_REQUIRED',
          title: 'Sign in again with a one-time code to set a password',
        });
      }
    }
    const hash = await argon2.hash(next);
    await this.prisma.passwordCredential.upsert({
      where: { userId },
      create: { userId, hash },
      update: { hash },
    });
    await this.sessions.revokeAllExcept(userId, sessionId);
  }
}

function invalid(field: string, message: string) {
  return new AppException(400, {
    code: 'VALIDATION_FAILED',
    title: 'Invalid request',
    errors: { [field]: [message] },
  });
}
