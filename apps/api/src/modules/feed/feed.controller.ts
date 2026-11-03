import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentAuth, type AuthContext } from '../../common/auth-context';
import { DashboardService } from './dashboard.service';
import {
  FeedPageDto,
  FeedQuery,
  JourneyDto,
  MentorDashboardDto,
} from './feed.dto';
import { FeedService } from './feed.service';

@ApiTags('feed')
@Controller()
export class FeedController {
  constructor(
    private readonly feed: FeedService,
    private readonly dashboards: DashboardService,
  ) {}

  /** A member's history: the member, their mentor and admins (US-4.2, US-5.1). */
  @Get('feed')
  @ApiOkResponse({ type: FeedPageDto })
  list(
    @CurrentAuth() auth: AuthContext,
    @Query() query: FeedQuery,
  ): Promise<FeedPageDto> {
    return this.feed.feed(auth.userId, query);
  }

  /** US-4.1: the signed-in mentor's mentees at a glance; empty for someone with none. */
  @Get('dashboard/mentor')
  @ApiOkResponse({ type: MentorDashboardDto })
  mentor(@CurrentAuth() auth: AuthContext): Promise<MentorDashboardDto> {
    return this.dashboards.mentor(auth.userId);
  }

  /** US-5.1: the signed-in member's tasks, plans and what's coming up. */
  @Get('dashboard/journey')
  @ApiOkResponse({ type: JourneyDto })
  journey(@CurrentAuth() auth: AuthContext): Promise<JourneyDto> {
    return this.dashboards.journey(auth.userId);
  }
}
