import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ActivityTypeRefDto, TaskDto } from '../interactions/interactions.dto';
import { MyMenteeDto } from '../mentorships/mentorships.dto';
import { PlanSummaryDto } from '../plans/plans.dto';
import { UserRefDto } from '../users/users.dto';

const FEED_KINDS = ['FOLLOW_UP', 'ACTIVITY', 'CHECK_IN', 'REPLY'] as const;
type FeedKind = (typeof FEED_KINDS)[number];

export class PlanRefDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
}

/**
 * One entry in a member's history (BR-GRP-9 adds gatherings in step 8). Only
 * what everyone allowed to see the feed may read: never private notes.
 */
export class FeedItemDto {
  /** Unique across kinds, e.g. `FOLLOW_UP:<id>`. */
  @ApiProperty() key!: string;
  @ApiProperty({ enum: FEED_KINDS, enumName: 'FeedKind' }) kind!: FeedKind;
  @ApiProperty({ format: 'date-time' }) at!: string;
  /** Who logged the follow-up or activity, checked in, or replied. */
  @ApiProperty({ type: UserRefDto }) actor!: UserRefDto;
  /** The super admin who did it while impersonating the actor (BR-ADM-5). */
  @ApiProperty({ type: UserRefDto, nullable: true })
  impersonator!: UserRefDto | null;

  /** Follow-ups and activities. */
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  interactionId!: string | null;
  @ApiProperty({ type: String, nullable: true }) title!: string | null;
  @ApiProperty({ type: ActivityTypeRefDto, nullable: true })
  activityType!: ActivityTypeRefDto | null;
  @ApiProperty() planUpdates!: number;
  @ApiProperty() challenges!: number;
  @ApiProperty() tasks!: number;
  @ApiProperty() participants!: number;

  /** Check-ins and replies. */
  @ApiProperty({ type: PlanRefDto, nullable: true }) plan!: PlanRefDto | null;
  @ApiProperty({ type: Number, nullable: true }) value!: number | null;
  /** The check-in's note or the reply. */
  @ApiProperty({ type: String, nullable: true }) text!: string | null;
}

export class FeedPageDto {
  @ApiProperty({ type: FeedItemDto, isArray: true }) items!: FeedItemDto[];
  /** Pass as `before` for the next page. */
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  nextCursor!: string | null;
}

export class FeedQuery {
  @ApiProperty({ format: 'uuid' }) @IsUUID() userId!: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  before?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

/** A follow-up or activity that hasn't started yet (BR-FU-3). */
export class UpcomingDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['FOLLOW_UP', 'ACTIVITY'], enumName: 'InteractionKind' })
  kind!: 'FOLLOW_UP' | 'ACTIVITY';
  @ApiProperty({ type: String, nullable: true }) title!: string | null;
  @ApiProperty({ type: ActivityTypeRefDto, nullable: true })
  activityType!: ActivityTypeRefDto | null;
  @ApiProperty({ format: 'date-time' }) startsAt!: string;
  @ApiProperty({ type: String, nullable: true }) place!: string | null;
  @ApiProperty({ type: UserRefDto }) createdBy!: UserRefDto;
  @ApiProperty({ type: UserRefDto, isArray: true })
  participants!: UserRefDto[];
}

export class DashboardMenteeDto extends MyMenteeDto {
  /** The open plan with the latest reading, else the newest open plan. */
  @ApiProperty({ type: PlanSummaryDto, nullable: true })
  mainPlan!: PlanSummaryDto | null;
  @ApiProperty() openPlans!: number;
  @ApiProperty() worseningPlans!: number;
}

export class MentorStatsDto {
  @ApiProperty() mentees!: number;
  /** Due or late (BR-FU-5). */
  @ApiProperty() needContact!: number;
  /** Done this calendar month in the organisation zone. */
  @ApiProperty() monthFollowUps!: number;
  @ApiProperty() monthActivities!: number;
  @ApiProperty() openPlans!: number;
  @ApiProperty() improving!: number;
  @ApiProperty() steady!: number;
  @ApiProperty() worse!: number;
}

export class MyMentorDto {
  @ApiProperty({ type: UserRefDto }) user!: UserRefDto;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastContactAt!: string | null;
  @ApiProperty() openPlans!: number;
}

/** US-4.1 · design/screens/Main.dc.html */
export class MentorDashboardDto {
  @ApiProperty({ type: MentorStatsDto }) stats!: MentorStatsDto;
  @ApiProperty({ type: DashboardMenteeDto, isArray: true })
  mentees!: DashboardMenteeDto[];
  @ApiProperty({ type: UpcomingDto, isArray: true }) upcoming!: UpcomingDto[];
  /** Set when the mentor is a mentee too. */
  @ApiProperty({ type: MyMentorDto, nullable: true })
  mentor!: MyMentorDto | null;
}

/** US-5.1 · design/screens/MyJourney.dc.html */
export class JourneyDto {
  @ApiProperty({ type: UserRefDto, nullable: true }) mentor!: UserRefDto | null;
  /** Open one-time tasks, soonest due first. */
  @ApiProperty({ type: TaskDto, isArray: true }) tasks!: TaskDto[];
  /** Open plans; `checkInDue` marks the ones waiting for a report. */
  @ApiProperty({ type: PlanSummaryDto, isArray: true })
  plans!: PlanSummaryDto[];
  @ApiProperty({ type: UpcomingDto, isArray: true }) upcoming!: UpcomingDto[];
}
