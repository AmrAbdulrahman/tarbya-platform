import { Module } from '@nestjs/common';
import { MentorshipsModule } from '../mentorships/mentorships.module';
import { PlansModule } from '../plans/plans.module';
import { DashboardService } from './dashboard.service';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';

@Module({
  imports: [MentorshipsModule, PlansModule],
  controllers: [FeedController],
  providers: [FeedService, DashboardService],
})
export class FeedModule {}
