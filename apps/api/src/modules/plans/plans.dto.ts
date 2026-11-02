import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
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
import { UserRefDto } from '../users/users.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const trimOrNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;
const TRENDS = ['IMPROVING', 'STEADY', 'WORSE', 'NEW'] as const;

export class TrackingMethodRefDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() nameAr!: string;
  @ApiProperty() nameEn!: string;
}

export class PlanSummaryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) menteeId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() goal!: string;
  @ApiProperty({ type: TrackingMethodRefDto })
  trackingMethod!: TrackingMethodRefDto;
  @ApiProperty() target!: number;
  @ApiProperty() higherIsBetter!: boolean;
  @ApiProperty({ type: String, format: 'date', nullable: true }) endsOn!:
    string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  closedAt!: string | null;
  /** The latest reading, if any. */
  @ApiProperty({ type: Number, nullable: true }) latest!: number | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  latestAt!: string | null;
  /** BR-PLAN-4, from the settings' trend window and steady band. */
  @ApiProperty({ enum: TRENDS, enumName: 'Trend' })
  trend!: (typeof TRENDS)[number];
  @ApiProperty() change!: number;
  /** Up to the last 12 readings, oldest first, for the sparkline. */
  @ApiProperty({ type: Number, isArray: true }) points!: number[];
}

export class PlanReplyDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() body!: string;
  @ApiProperty({ type: UserRefDto }) author!: UserRefDto;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class PlanReadingDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() value!: number;
  @ApiProperty({ type: String, nullable: true }) note!: string | null;
  @ApiProperty({ enum: ['FOLLOW_UP', 'CHECK_IN'], enumName: 'ReadingSource' })
  source!: 'FOLLOW_UP' | 'CHECK_IN';
  @ApiProperty() needsHelp!: boolean;
  @ApiProperty({ format: 'date-time' }) recordedAt!: string;
  @ApiProperty({ type: UserRefDto }) author!: UserRefDto;
  @ApiProperty({ type: PlanReplyDto, isArray: true }) replies!: PlanReplyDto[];
}

export class PlanDetailDto extends PlanSummaryDto {
  @ApiProperty({ type: UserRefDto }) mentee!: UserRefDto;
  /** Newest first. */
  @ApiProperty({ type: PlanReadingDto, isArray: true })
  readings!: PlanReadingDto[];
  /** The viewer is the mentee's current mentor or a moderator (BR-PLAN-2). */
  @ApiProperty() canManage!: boolean;
  /** The viewer is the mentee and the plan is open (US-5.2). */
  @ApiProperty() canCheckIn!: boolean;
}

export class PlansQuery {
  @ApiProperty({ format: 'uuid' }) @IsUUID() menteeId!: string;
}

export class CreatePlanDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() menteeId!: string;

  @ApiProperty({ maxLength: 120 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ maxLength: 300 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  goal!: string;

  @ApiProperty({ format: 'uuid' }) @IsUUID() trackingMethodId!: string;

  @ApiProperty() @IsNumber() @Min(-1_000_000) @Max(1_000_000) target!: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  higherIsBetter?: boolean;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endsOn?: string | null;
}

/** A plan stays with its mentee. */
export class UpdatePlanDto extends PartialType(
  OmitType(CreatePlanDto, ['menteeId'] as const),
) {
  /** Close (true) or reopen (false) the plan. */
  @ApiPropertyOptional() @IsOptional() @IsBoolean() closed?: boolean;
}

/** US-5.2 */
export class CheckInDto {
  @ApiProperty() @IsNumber() @Min(-1_000_000) @Max(1_000_000) value!: number;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 2000 })
  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(2000)
  note?: string | null;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() needsHelp?: boolean;
}

/** BR-PLAN-5 */
export class PlanReplyBodyDto {
  @ApiProperty({ maxLength: 2000 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;
}
