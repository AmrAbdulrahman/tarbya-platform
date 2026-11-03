import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@tarbya/db';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  decideRefresh,
  formatRefreshToken,
  newSecret,
  parseRefreshToken,
  REFRESH_TOKEN_TTL_DAYS,
  sha256,
} from './tokens';

export interface ClientMeta {
  ip?: string;
  userAgent?: string;
}

export interface IssuedTokens {
  userId: string;
  accessToken: string;
  /** Absent when an old token was accepted within the grace window: the browser keeps the newer one. */
  refreshToken?: string;
}

export interface AccessClaims {
  /** Whose app this is: the signed-in user, or the one being impersonated. */
  sub: string;
  sid: string;
  /** Set while the session's owner (the super admin) impersonates `sub`. */
  act?: string;
}

interface SessionRef {
  id: string;
  userId: string;
  impersonatedUserId: string | null;
}

/** Sessions and their tokens (US-1.3). */
@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async create(userId: string, meta: ClientMeta): Promise<IssuedTokens> {
    const secret = newSecret();
    const session = await this.prisma.session.create({
      data: {
        userId,
        tokenHash: sha256(secret),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 86_400_000),
        ip: meta.ip,
        userAgent: meta.userAgent?.slice(0, 500),
      },
    });
    return {
      userId,
      accessToken: this.accessToken(session),
      refreshToken: formatRefreshToken(session.id, secret),
    };
  }

  /**
   * Returns new tokens, or undefined when the token is unknown, expired or revoked.
   * `stillAllowed` re-checks that the user may sign in, so deactivation and
   * setting changes take effect at the next refresh.
   */
  async refresh(
    token: string | undefined,
    stillAllowed: (userId: string) => Promise<boolean>,
  ): Promise<IssuedTokens | undefined> {
    const parsed = parseRefreshToken(token);
    if (!parsed) return undefined;
    const session = await this.prisma.session.findUnique({
      where: { id: parsed.sessionId },
    });
    if (!session) return undefined;

    const now = new Date();
    const decision = decideRefresh(session, sha256(parsed.secret), now);
    if (decision === 'invalid') return undefined;
    if (decision === 'reuse') {
      await this.revoke(session.id);
      return undefined;
    }
    if (!(await stillAllowed(session.userId))) {
      await this.revoke(session.id);
      return undefined;
    }
    if (
      session.impersonatedUserId &&
      !(await this.prisma.user.count({
        where: { id: session.impersonatedUserId, deactivatedAt: null },
      }))
    ) {
      // The impersonated user was deactivated: back to the owner's own view.
      session.impersonatedUserId = null;
      await this.prisma.session.update({
        where: { id: session.id },
        data: { impersonatedUserId: null },
      });
    }
    if (decision === 'grace') {
      return {
        userId: session.userId,
        accessToken: this.accessToken(session),
      };
    }

    const secret = newSecret();
    // Only rotate if nobody rotated it in the meantime.
    const { count } = await this.prisma.session.updateMany({
      where: { id: session.id, tokenHash: session.tokenHash },
      data: {
        tokenHash: sha256(secret),
        previousHash: session.tokenHash,
        rotatedAt: now,
        lastUsedAt: now,
      },
    });
    if (count === 0) return undefined;
    return {
      userId: session.userId,
      accessToken: this.accessToken(session),
      refreshToken: formatRefreshToken(session.id, secret),
    };
  }

  /** Validates an access token and that its session is still live. */
  async verifyAccess(
    token: string | undefined,
  ): Promise<AccessClaims | undefined> {
    if (!token) return undefined;
    let claims: AccessClaims;
    try {
      claims = await this.jwt.verifyAsync<AccessClaims>(token);
    } catch {
      return undefined;
    }
    // Checked on every request so sign-out and deactivation apply at once.
    // The token must match the session's current impersonation, so stopping it applies at once.
    const live = await this.prisma.session.count({
      where: {
        id: claims.sid,
        userId: claims.act ?? claims.sub,
        impersonatedUserId: claims.act ? claims.sub : null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { deactivatedAt: null },
        ...(claims.act && {
          impersonatedUser: { is: { deactivatedAt: null } },
        }),
      },
    });
    return live ? claims : undefined;
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAll(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllExcept(userId: string, keepSessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null, id: { not: keepSessionId } },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Starts (a user id) or stops (null) impersonating in this session and
   * returns the access token for the new view. The refresh token is unchanged.
   */
  async impersonate(
    sessionId: string,
    impersonatedUserId: string | null,
  ): Promise<IssuedTokens> {
    const session = await this.prisma.session.update({
      where: { id: sessionId },
      data: { impersonatedUserId },
    });
    return { userId: session.userId, accessToken: this.accessToken(session) };
  }

  /** The session a refresh token names, if it parses; used to sign out without a valid access token. */
  sessionIdOf(refreshToken: string | undefined): string | undefined {
    return parseRefreshToken(refreshToken)?.sessionId;
  }

  private accessToken(session: SessionRef): string {
    const claims: AccessClaims = session.impersonatedUserId
      ? {
          sub: session.impersonatedUserId,
          sid: session.id,
          act: session.userId,
        }
      : { sub: session.userId, sid: session.id };
    return this.jwt.sign(claims, { expiresIn: ACCESS_TOKEN_TTL_SECONDS });
  }
}
