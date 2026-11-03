import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { Env } from '../../config/env';
import { NotWhileImpersonating } from '../../common/access';
import { unauthenticated } from '../../common/app-exception';
import { CurrentAuth, type AuthContext } from '../../common/auth-context';
import { Public } from '../../common/public.decorator';
import {
  CodeSignInDto,
  ImpersonateDto,
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
    return this.auth.me(tokens.userId);
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
    return this.auth.me(tokens.userId);
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
  @NotWhileImpersonating()
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
    return this.auth.me(auth.userId, auth.impersonatorId);
  }

  /** The super admin views the app as another user, in this session only. */
  @Post('impersonation')
  @HttpCode(200)
  @ApiOkResponse({ type: MeDto })
  @ApiForbiddenResponse({ description: 'FORBIDDEN' })
  @ApiConflictResponse({
    description: 'SELF_ACTION, SUPER_ADMIN_LOCKED, USER_INACTIVE',
  })
  async impersonate(
    @CurrentAuth() auth: AuthContext,
    @Body() body: ImpersonateDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MeDto> {
    const tokens = await this.auth.impersonate(auth, body.userId);
    setAuthCookies(res, tokens, this.secureCookies);
    return this.auth.me(body.userId, tokens.userId);
  }

  /** Back to the super admin's own view. */
  @Delete('impersonation')
  @ApiOkResponse({ type: MeDto })
  async stopImpersonating(
    @CurrentAuth() auth: AuthContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MeDto> {
    const tokens = await this.auth.stopImpersonating(auth);
    setAuthCookies(res, tokens, this.secureCookies);
    return this.auth.me(tokens.userId);
  }
}

function meta(req: Request): ClientMeta {
  return { ip: req.ip, userAgent: req.get('user-agent') };
}
