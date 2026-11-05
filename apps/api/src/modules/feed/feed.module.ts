import { Module } from '@nestjs/common';
import { GroupsModule } from '../groups/groups.module';
import { MentorshipsModule } from '../mentorships/mentorships.module';
import { TrackablesModule } from '../trackables/trackables.module';
import { DashboardService } from './dashboard.service';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';

@Module({
  imports: [MentorshipsModule, TrackablesModule, GroupsModule],
  controllers: [FeedController],
  providers: [FeedService, DashboardService],
})
export class FeedModule {}
