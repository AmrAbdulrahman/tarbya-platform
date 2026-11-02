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
import { AuditModule } from '../modules/audit/audit.module';
import { AuthModule } from '../modules/auth/auth.module';
import { FilesModule } from '../modules/files/files.module';
import { HierarchyModule } from '../modules/hierarchy/hierarchy.module';
import { MeModule } from '../modules/me/me.module';
import { InteractionsModule } from '../modules/interactions/interactions.module';
import { LookupsModule } from '../modules/lookups/lookups.module';
import { MentorshipsModule } from '../modules/mentorships/mentorships.module';
import { NotesModule } from '../modules/notes/notes.module';
import { ProfilesModule } from '../modules/profiles/profiles.module';
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
    AuditModule,
    HierarchyModule,
    SettingsModule,
    UsersModule,
    AuthModule,
    LookupsModule,
    MentorshipsModule,
    InteractionsModule,
    NotesModule,
    ProfilesModule,
    FilesModule,
    MeModule,
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
