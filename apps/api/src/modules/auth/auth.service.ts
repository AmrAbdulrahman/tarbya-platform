import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService, type User } from '@tarbya/db';
import { canSignIn } from '@tarbya/shared';
import * as argon2 from 'argon2';
import type { Env } from '../../config/env';
import { forbidden } from '../../common/access';
import { AppException } from '../../common/app-exception';
import type { AuthContext } from '../../common/auth-context';
import { AuditService } from '../audit/audit.service';
import { AvatarsService } from '../files/avatars.service';
import { MailService } from '../mail/mail.service';
import { SettingsService } from '../settings/settings.service';
import { RolesService } from '../users/roles.service';
import type { MeDto } from './auth.dto';
import { signInCodeMail } from './mail-templates';
import {
  SessionsService,
  type ClientMeta,
  type IssuedTokens,
} from './sessions.service';
import {
  CODE_MAX_ATTEMPTS,
  CODE_MAX_PER_WINDOW,
  CODE_TTL_MINUTES,
  CODE_WINDOW_MINUTES,
  hashCode,
  newCode,
  normalizeEmail,
  safeEqual,
} from './tokens';

const invalidCredentials = () =>
  new AppException(401, {
    code: 'AUTH_INVALID_CREDENTIALS',
    title: 'Wrong email or password',
  });

const invalidCode = () =>
  new AppException(401, {
    code: 'AUTH_CODE_INVALID',
    title: 'The code is wrong or has expired',
  });

/** Sign-in with a password (US-1.1) or an emailed code (US-1.2). */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly codeKey: string;
  // Verified against when the email is unknown, so both paths take as long.
  private readonly dummyHash = argon2.hash('not-a-real-password');

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
    private readonly roles: RolesService,
    private readonly settings: SettingsService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    config: ConfigService<Env, true>,
  ) {
    this.codeKey = config.get('JWT_SECRET', { infer: true });
  }

  async signInWithPassword(
    email: string,
    password: string,
    meta: ClientMeta,
  ): Promise<IssuedTokens> {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
      include: { password: true },
    });
    const hash = user?.password?.hash ?? (await this.dummyHash);
    const ok = await argon2.verify(hash, password).catch(() => false);
    if (!user?.password || !ok) throw invalidCredentials();

    // Only after the password matched, so these don't reveal which emails exist.
    await this.assertMaySignIn(user);
    return this.sessions.create(user.id, meta);
  }

  /** Always resolves the same way, whether or not a code was sent (US-1.2). */
  async requestCode(email: string): Promise<void> {
    const address = normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { email: address },
    });
    if (!user || !(await this.maySignIn(user))) return;

    const since = new Date(Date.now() - CODE_WINDOW_MINUTES * 60_000);
    const recent = await this.prisma.oneTimeCode.count({
      where: { email: address, purpose: 'SIGN_IN', createdAt: { gte: since } },
    });
    if (recent >= CODE_MAX_PER_WINDOW) return;

    const code = newCode();
    await this.prisma.$transaction([
      // A new code replaces any earlier one.
      this.prisma.oneTimeCode.updateMany({
        where: { email: address, purpose: 'SIGN_IN', usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.oneTimeCode.create({
        data: {
          email: address,
          purpose: 'SIGN_IN',
          codeHash: hashCode(code, this.codeKey),
          expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60_000),
        },
      }),
    ]);
    try {
      await this.mail.send(signInCodeMail(address, code, user.locale));
    } catch (error) {
      this.logger.error(`Could not send a sign-in code: ${String(error)}`);
    }
  }

  async signInWithCode(
    email: string,
    code: string,
    meta: ClientMeta,
  ): Promise<IssuedTokens> {
    const address = normalizeEmail(email);
    const pending = await this.prisma.oneTimeCode.findFirst({
      where: {
        email: address,
        purpose: 'SIGN_IN',
        usedAt: null,
        expiresAt: { gt: new Date() },
        attempts: { lt: CODE_MAX_ATTEMPTS },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!pending) throw invalidCode();

    if (!safeEqual(hashCode(code, this.codeKey), pending.codeHash)) {
      await this.prisma.oneTimeCode.update({
        where: { id: pending.id },
        data: { attempts: { increment: 1 } },
      });
      throw invalidCode();
    }
    // Single use, even under concurrent requests.
    const { count } = await this.prisma.oneTimeCode.updateMany({
      where: { id: pending.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (count === 0) throw invalidCode();

    const user = await this.prisma.user.findUnique({
      where: { email: address },
    });
    if (!user) throw invalidCode();
    await this.assertMaySignIn(user);
    return this.sessions.create(user.id, meta);
  }

  /** Used on refresh: is this user still allowed in? */
  async userMaySignIn(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return !!user && (await this.maySignIn(user));
  }

  private async maySignIn(user: User): Promise<boolean> {
    if (user.deactivatedAt || !user.email) return false;
    const [roles, allowed] = await Promise.all([
      this.roles.rolesOf(user.id),
      this.settings.get('auth.signInRoles'),
    ]);
    return canSignIn(roles, allowed);
  }

  private async assertMaySignIn(user: User): Promise<void> {
    if (user.deactivatedAt) {
      throw new AppException(403, {
        code: 'AUTH_DEACTIVATED',
        title: 'This account is deactivated',
      });
    }
    if (!(await this.maySignIn(user))) {
      throw new AppException(403, {
        code: 'AUTH_NOT_ALLOWED',
        title: 'Sign-in is not open to your role yet',
      });
    }
  }

  /** The signed-in user, and the super admin behind them while impersonating. */
  async me(userId: string, impersonatorId?: string): Promise<MeDto> {
    const [user, roles, impersonator] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.roles.rolesOf(userId),
      impersonatorId
        ? this.prisma.user.findUniqueOrThrow({
            where: { id: impersonatorId },
            select: { id: true, name: true },
          })
        : null,
    ]);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      locale: user.locale,
      calendar: user.calendar,
      roles,
      avatarUrl: AvatarsService.url(user.id, user.avatarFileId),
      impersonator,
    };
  }

  /**
   * The super admin views the app as an active user, in this session only.
   * Starting again while impersonating switches to the new user.
   */
  async impersonate(auth: AuthContext, userId: string): Promise<IssuedTokens> {
    const adminId = auth.impersonatorId ?? auth.userId;
    if (!(await this.roles.isSuperAdminUser(adminId))) throw forbidden();
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      throw new AppException(404, {
        code: 'NOT_FOUND',
        title: 'User not found',
      });
    }
    if (target.id === adminId) {
      throw new AppException(409, {
        code: 'SELF_ACTION',
        title: "You can't impersonate yourself",
      });
    }
    if (this.roles.isSuperAdmin(target.email)) {
      throw new AppException(409, {
        code: 'SUPER_ADMIN_LOCKED',
        title: "The super admin can't be impersonated",
      });
    }
    if (target.deactivatedAt) {
      throw new AppException(409, {
        code: 'USER_INACTIVE',
        title: "A deactivated user can't be impersonated",
      });
    }
    const tokens = await this.sessions.impersonate(auth.sessionId, target.id);
    await this.audit.record({
      actorId: adminId,
      action: 'user.impersonate.start',
      entity: 'User',
      entityId: target.id,
    });
    return tokens;
  }

  async stopImpersonating(auth: AuthContext): Promise<IssuedTokens> {
    if (!auth.impersonatorId) throw forbidden();
    const tokens = await this.sessions.impersonate(auth.sessionId, null);
    await this.audit.record({
      actorId: auth.impersonatorId,
      action: 'user.impersonate.stop',
      entity: 'User',
      entityId: auth.userId,
    });
    return tokens;
  }
}
