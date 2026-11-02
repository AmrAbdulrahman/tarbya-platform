import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { PrismaService } from '@tarbya/db';
import type { Request, Response } from 'express';
import type { Env } from '../../config/env';
import { unauthenticated } from '../../common/app-exception';
import { CurrentAuth, type AuthContext } from '../../common/auth-context';
import { Public } from '../../common/public.decorator';
import { RolesService } from '../users/roles.service';
import {
  CodeSignInDto,
  MeDto,
  PasswordSignInDto,
  RequestCodeDto,
} from './auth.dto';
import { AuthService } from './auth.service';
import { clearAuthCookies, REFRESH_COOKIE, setAuthCookies } from './cookies';
import { SessionsService, type ClientMeta } from './sessions.service';

// Sign-in routes are throttled per client IP (AUTH_SIGN_IN_LIMIT_PER_MINUTE),
// on top of the per-email limit for codes.
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly secureCookies: boolean;

  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionsService,
    private readonly roles: RolesService,
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.secureCookies =
      config.get('NODE_ENV', { infer: true }) === 'production';
  }

  /** US-1.1 */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('sign-in/password')
  @HttpCode(200)
  @ApiOkResponse({ type: MeDto })
  @ApiUnauthorizedResponse({ description: 'AUTH_INVALID_CREDENTIALS' })
  @ApiTooManyRequestsResponse({ description: 'RATE_LIMITED' })
  async signInWithPassword(
    @Body() body: PasswordSignInDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MeDto> {
    const tokens = await this.auth.signInWithPassword(
      body.email,
      body.password,
      meta(req),
    );
    setAuthCookies(res, tokens, this.secureCookies);
    return this.me(tokens.userId);
  }

  /** US-1.2: always 204, whether or not the email belongs to someone who can sign in. */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('sign-in/code/request')
  @HttpCode(204)
  @ApiNoContentResponse()
  async requestCode(@Body() body: RequestCodeDto): Promise<void> {
    await this.auth.requestCode(body.email);
  }

  /** US-1.2 */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('sign-in/code')
  @HttpCode(200)
  @ApiOkResponse({ type: MeDto })
  @ApiUnauthorizedResponse({ description: 'AUTH_CODE_INVALID' })
  async signInWithCode(
    @Body() body: CodeSignInDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MeDto> {
    const tokens = await this.auth.signInWithCode(
      body.email,
      body.code,
      meta(req),
    );
    setAuthCookies(res, tokens, this.secureCookies);
    return this.me(tokens.userId);
  }

  /** US-1.3: swaps the refresh cookie for new tokens. */
  @Public()
  @Post('refresh')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ description: 'AUTH_UNAUTHENTICATED' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const tokens = await this.sessions.refresh(
      req.cookies?.[REFRESH_COOKIE],
      (id) => this.auth.userMaySignIn(id),
    );
    if (!tokens) {
      clearAuthCookies(res, this.secureCookies);
      throw unauthenticated();
    }
    setAuthCookies(res, tokens, this.secureCookies);
  }

  /** Ends this session. Public so it works after the access token expired. */
  @Public()
  @Post('sign-out')
  @HttpCode(204)
  @ApiNoContentResponse()
  async signOut(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const sessionId = this.sessions.sessionIdOf(req.cookies?.[REFRESH_COOKIE]);
    if (sessionId) await this.sessions.revoke(sessionId);
    clearAuthCookies(res, this.secureCookies);
  }

  /** Ends every session of the signed-in user. */
  @Post('sign-out/everywhere')
  @HttpCode(204)
  @ApiNoContentResponse()
  async signOutEverywhere(
    @CurrentAuth() auth: AuthContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.sessions.revokeAll(auth.userId);
    clearAuthCookies(res, this.secureCookies);
  }

  @Get('me')
  @ApiOkResponse({ type: MeDto })
  @ApiUnauthorizedResponse({ description: 'AUTH_UNAUTHENTICATED' })
  getMe(@CurrentAuth() auth: AuthContext): Promise<MeDto> {
    return this.me(auth.userId);
  }

  private async me(userId: string): Promise<MeDto> {
    const [user, roles] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.roles.rolesOf(userId),
    ]);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      locale: user.locale,
      calendar: user.calendar,
      roles,
    };
  }
}

function meta(req: Request): ClientMeta {
  return { ip: req.ip, userAgent: req.get('user-agent') };
}
