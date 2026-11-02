import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { DbModule } from '@tarbya/db';
import cookieParser from 'cookie-parser';
import { resolve } from 'node:path';
import { validateEnv } from '../config/env';
import { CsrfMiddleware } from '../common/csrf.middleware';
import { ProblemDetailsFilter } from '../common/problem-details.filter';
import { validationPipe } from '../common/validation.pipe';
import { AuthModule } from '../modules/auth/auth.module';
import { MailModule } from '../modules/mail/mail.module';
import { SettingsModule } from '../modules/settings/settings.module';
import { UsersModule } from '../modules/users/users.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolve(process.cwd(), '.env'),
      validate: validateEnv,
    }),
    DbModule,
    MailModule,
    SettingsModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    { provide: APP_PIPE, useValue: validationPipe },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(cookieParser(), CsrfMiddleware).forRoutes('*path');
  }
}
