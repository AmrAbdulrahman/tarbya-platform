import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { Cycle, TrackableType } from '@tarbya/shared';
import { UserRefDto } from '../users/users.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const trimOrNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;
const TRENDS = ['IMPROVING', 'STEADY', 'WORSE', 'NEW'] as const;
const TYPES = ['COUNT', 'BOOLEAN', 'PERCENTAGE'] as const;
const CYCLES = ['DAILY', 'WEEKLY', 'MONTHLY'] as const;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** BR-TRK-1…5 */
export class TrackableSummaryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) menteeId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) goal!: string | null;
  @ApiProperty({ enum: TYPES, enumName: 'TrackableType' }) type!: TrackableType;
  @ApiProperty({ enum: CYCLES, enumName: 'TrackingCycle' }) cycle!: Cycle;
  @ApiProperty() higherIsBetter!: boolean;
  /** Per cycle. */
  @ApiProperty({ type: Number, nullable: true }) target!: number | null;
  @ApiProperty({ format: 'date' }) startsOn!: string;
  /** Weekly only: the weekday (0 Sunday … 6 Saturday) its log shows on. */
  @ApiProperty({ type: Number, nullable: true, minimum: 0, maximum: 6 })
  weekday!: number | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  archivedAt!: string | null;
  /** The cycle today falls in (its first day). */
  @ApiProperty({ format: 'date' }) currentCycle!: string;
  /** The latest logged cycle and its value. */
  @ApiProperty({ type: String, format: 'date', nullable: true })
  latestCycle!: string | null;
  @ApiProperty({ type: Number, nullable: true }) latest!: number | null;
  @ApiProperty() logged!: number;
  /** Ended cycles with nothing logged. */
  @ApiProperty() missed!: number;
  /** Logged share of the ended cycles, 0–1; null before the first ends. */
  @ApiProperty({ type: Number, nullable: true }) rate!: number | null;
  /** Unlogged cycles still worth filling: the current one and the last 30 days (BR-TRK-4). */
  @ApiProperty({ type: String, format: 'date', isArray: true })
  openCycles!: string[];
  @ApiProperty({ enum: TRENDS, enumName: 'Trend' })
  trend!: (typeof TRENDS)[number];
  @ApiProperty() change!: number;
  /** One value per cycle, oldest first, the last 12. */
  @ApiProperty({ type: Number, isArray: true }) points!: number[];
}

export class TrackableReplyDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() body!: string;
  @ApiProperty({ type: UserRefDto }) author!: UserRefDto;
  /** The super admin who wrote this while impersonating the author (BR-ADM-5). */
  @ApiProperty({ type: UserRefDto, nullable: true })
  impersonator!: UserRefDto | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class TrackableEntryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'date' }) periodStart!: string;
  @ApiProperty() value!: number;
  @ApiProperty({ type: String, nullable: true }) note!: string | null;
  @ApiProperty({ enum: ['MENTEE', 'MENTOR'], enumName: 'EntrySource' })
  source!: 'MENTEE' | 'MENTOR';
  @ApiProperty() needsHelp!: boolean;
  @ApiProperty({ format: 'date-time' }) recordedAt!: string;
  @ApiProperty({ type: UserRefDto }) author!: UserRefDto;
  /** The super admin who wrote this while impersonating the author (BR-ADM-5). */
  @ApiProperty({ type: UserRefDto, nullable: true })
  impersonator!: UserRefDto | null;
  @ApiProperty({ type: TrackableReplyDto, isArray: true })
  replies!: TrackableReplyDto[];
}

/** A library template (BR-TRK-7…9). */
export class TrackableTemplateDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) goal!: string | null;
  @ApiProperty({ enum: TYPES, enumName: 'TrackableType' })
  type!: TrackableType;
  @ApiProperty({ enum: CYCLES, enumName: 'TrackingCycle' })
  cycle!: Cycle;
  @ApiProperty() higherIsBetter!: boolean;
  /** Suggested target per cycle. */
  @ApiProperty({ type: Number, nullable: true }) target!: number | null;
  /** Offered to every mentor. */
  @ApiProperty() isPublic!: boolean;
  @ApiProperty({ type: UserRefDto }) author!: UserRefDto;
  /** The super admin who wrote this while impersonating the author (BR-ADM-5). */
  @ApiProperty({ type: UserRefDto, nullable: true })
  impersonator!: UserRefDto | null;
  /** Active trackables that follow it, across all mentees. */
  @ApiProperty() uses!: number;
  /** The viewer is the author or an admin. */
  @ApiProperty() canEdit!: boolean;
  /** Type and cycle can still change: nothing is logged on any linked trackable. */
  @ApiProperty() reshapable!: boolean;
  /** The mentee asked about already has an active trackable from it. */
  @ApiProperty() assigned!: boolean;
}

export class TrackableDetailDto extends TrackableSummaryDto {
  @ApiProperty({ type: UserRefDto }) mentee!: UserRefDto;
  /** The library template it follows (BR-TRK-8). */
  @ApiProperty({ type: TrackableTemplateDto, nullable: true })
  template!: TrackableTemplateDto | null;
  /** Newest cycle first. */
  @ApiProperty({ type: TrackableEntryDto, isArray: true })
  entries!: TrackableEntryDto[];
  /** The viewer is the mentee's current mentor or an admin (BR-TRK-6). */
  @ApiProperty() canManage!: boolean;
  /** The viewer may log cycles: the mentee, their mentor or an admin, while it's active. */
  @ApiProperty() canLog!: boolean;
}

/** An entry with the trackable it belongs to, for history across trackables. */
export class RangeEntryDto extends TrackableEntryDto {
  @ApiProperty({ format: 'uuid' }) trackableId!: string;
}

/** A mentee's entries on every trackable, for cycles starting between two days. */
export class EntriesQuery {
  @ApiProperty({ format: 'uuid' }) @IsUUID() menteeId!: string;
  @ApiProperty({ format: 'date' }) @Matches(DAY) from!: string;
  @ApiProperty({ format: 'date' }) @Matches(DAY) to!: string;
}

export class TrackablesQuery {
  @ApiProperty({ format: 'uuid' }) @IsUUID() menteeId!: string;
}

export class CreateTrackableDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() menteeId!: string;

  @ApiProperty({ maxLength: 120 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 300 })
  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(300)
  goal?: string | null;

  @ApiProperty({ enum: TYPES, enumName: 'TrackableType' })
  @IsIn(TYPES)
  type!: TrackableType;

  @ApiProperty({ enum: CYCLES, enumName: 'TrackingCycle' })
  @IsIn(CYCLES)
  cycle!: Cycle;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  higherIsBetter?: boolean;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  target?: number | null;

  /** Defaults to today; earlier days make their cycles fillable (within 30 days). */
  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @Matches(DAY)
  startsOn?: string;

  /** Weekly only: the weekday (0 Sunday … 6 Saturday) its log shows on; null for the week's first day. */
  @ApiPropertyOptional({ type: Number, nullable: true, minimum: 0, maximum: 6 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  weekday?: number | null;
}

/** A trackable stays with its mentee; its type, cycle and start change only until something is logged. */
export class UpdateTrackableDto extends PartialType(
  OmitType(CreateTrackableDto, ['menteeId'] as const),
) {
  /** Archive (true) or restore (false). */
  @ApiPropertyOptional() @IsOptional() @IsBoolean() archived?: boolean;
}

/** One cycle's value (BR-TRK-3). Done/not done is 1 or 0; a percentage is 0–100. */
export class LogEntryDto {
  @ApiProperty() @IsNumber() @Min(0) @Max(1_000_000) value!: number;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 2000 })
  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(2000)
  note?: string | null;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() needsHelp?: boolean;
}

export class ReplyBodyDto {
  @ApiProperty({ maxLength: 2000 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;
}
