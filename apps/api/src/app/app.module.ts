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
import { RequestContextMiddleware } from '../common/request-context';
import { AuditModule } from '../modules/audit/audit.module';
import { AuthModule } from '../modules/auth/auth.module';
import { FeedModule } from '../modules/feed/feed.module';
import { GroupsModule } from '../modules/groups/groups.module';
import { JobsModule } from '../modules/jobs/jobs.module';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { EventsModule } from '../modules/events/events.module';
import { MessagesModule } from '../modules/messages/messages.module';
import { FilesModule } from '../modules/files/files.module';
import { HierarchyModule } from '../modules/hierarchy/hierarchy.module';
import { MeModule } from '../modules/me/me.module';
import { InteractionsModule } from '../modules/interactions/interactions.module';
import { LookupsModule } from '../modules/lookups/lookups.module';
import { MentorshipsModule } from '../modules/mentorships/mentorships.module';
import { NotesModule } from '../modules/notes/notes.module';
import { TrackablesModule } from '../modules/trackables/trackables.module';
import { ChallengesModule } from '../modules/challenges/challenges.module';
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
    JobsModule,
    EventsModule,
    NotificationsModule,
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
    TrackablesModule,
    ChallengesModule,
    FeedModule,
    GroupsModule,
    MessagesModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    { provide: APP_PIPE, useValue: validationPipe },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestContextMiddleware, cookieParser(), CsrfMiddleware)
      .forRoutes('*path');
  }
}
