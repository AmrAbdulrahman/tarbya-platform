import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Env } from '../../config/env';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { SessionsService } from './sessions.service';
import { SuperAdminBootstrap } from './super-admin.bootstrap';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: { algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
    // In memory: fine for one API instance; move to a shared store if we scale out.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => [
        {
          ttl: 60_000,
          limit: config.get('AUTH_SIGN_IN_LIMIT_PER_MINUTE', { infer: true }),
        },
      ],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionsService,
    SuperAdminBootstrap,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
