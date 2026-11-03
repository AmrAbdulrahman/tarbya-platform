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
import { TrackableSummaryDto } from '../trackables/trackables.dto';
import { UserRefDto } from '../users/users.dto';

const FEED_KINDS = ['FOLLOW_UP', 'ACTIVITY', 'ENTRY', 'REPLY'] as const;
type FeedKind = (typeof FEED_KINDS)[number];

export class TrackableRefDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({
    enum: ['COUNT', 'BOOLEAN', 'PERCENTAGE'],
    enumName: 'TrackableType',
  })
  type!: 'COUNT' | 'BOOLEAN' | 'PERCENTAGE';
  @ApiProperty({
    enum: ['DAILY', 'WEEKLY', 'MONTHLY'],
    enumName: 'TrackingCycle',
  })
  cycle!: 'DAILY' | 'WEEKLY' | 'MONTHLY';
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
  /** Who logged the follow-up, activity or entry, or replied. */
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
  /** Trackable cycles logged in the follow-up. */
  @ApiProperty() trackableUpdates!: number;
  /** Challenges raised in the follow-up. */
  @ApiProperty({ type: String, isArray: true }) challenges!: string[];
  @ApiProperty() tasks!: number;
  @ApiProperty() participants!: number;

  /** The mentee's entries, and replies to entries. */
  @ApiProperty({ type: TrackableRefDto, nullable: true })
  trackable!: TrackableRefDto | null;
  /** The cycle the entry is for (its first day). */
  @ApiProperty({ type: String, format: 'date', nullable: true })
  cycle!: string | null;
  @ApiProperty({ type: Number, nullable: true }) value!: number | null;
  /** The entry's note or the reply. */
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
  /** The active trackable logged most recently, else the newest one. */
  @ApiProperty({ type: TrackableSummaryDto, nullable: true })
  mainTrackable!: TrackableSummaryDto | null;
  @ApiProperty() activeTrackables!: number;
  @ApiProperty() worseningTrackables!: number;
  @ApiProperty() openChallenges!: number;
}

export class MentorStatsDto {
  @ApiProperty() mentees!: number;
  /** Due or late (BR-FU-5). */
  @ApiProperty() needContact!: number;
  /** Done this calendar month in the organisation zone. */
  @ApiProperty() monthFollowUps!: number;
  @ApiProperty() monthActivities!: number;
  @ApiProperty() activeTrackables!: number;
  @ApiProperty() improving!: number;
  @ApiProperty() steady!: number;
  @ApiProperty() worse!: number;
}

export class MyMentorDto {
  @ApiProperty({ type: UserRefDto }) user!: UserRefDto;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastContactAt!: string | null;
  @ApiProperty() activeTrackables!: number;
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
  /** Open one-time tasks, soonest due first, then those done in the last 7 days. */
  @ApiProperty({ type: TaskDto, isArray: true }) tasks!: TaskDto[];
  /** Active trackables; `openCycles` lists the cycles waiting to be logged. */
  @ApiProperty({ type: TrackableSummaryDto, isArray: true })
  trackables!: TrackableSummaryDto[];
  @ApiProperty({ type: UpcomingDto, isArray: true }) upcoming!: UpcomingDto[];
}
