import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
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
  ValidateNested,
} from 'class-validator';
import { UserRefDto } from '../users/users.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const trimOrNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;
const trimList = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? value
        .map((v) => (typeof v === 'string' ? v.trim() : v))
        .filter((v) => v !== '')
    : value;

export class NewTaskDto {
  @ApiProperty({ minLength: 1, maxLength: 200 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  /** A calendar day (YYYY-MM-DD) in the organisation's time zone. */
  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dueOn?: string | null;
}

/** A reading for one of the mentee's plans, recorded at the follow-up (BR-PLAN-3). */
export class PlanUpdateDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  planId!: string;

  @ApiProperty()
  @IsNumber()
  @Min(-1_000_000)
  @Max(1_000_000)
  value!: number;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 2000 })
  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(2000)
  note?: string | null;
}

class InteractionFields {
  @ApiProperty({ format: 'date-time' })
  @IsDateString({ strict: true })
  startsAt!: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 200 })
  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(200)
  place?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 5000 })
  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(5000)
  sharedNotes?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 5000 })
  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(5000)
  privateNotes?: string | null;
}

/** US-4.3 */
export class CreateFollowUpDto extends InteractionFields {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  menteeId!: string;

  @ApiPropertyOptional({ type: String, isArray: true, maxItems: 20 })
  @IsOptional()
  @Transform(trimList)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  challenges?: string[];

  @ApiPropertyOptional({ type: NewTaskDto, isArray: true, maxItems: 20 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => NewTaskDto)
  tasks?: NewTaskDto[];

  @ApiPropertyOptional({ type: PlanUpdateDto, isArray: true, maxItems: 20 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PlanUpdateDto)
  planUpdates?: PlanUpdateDto[];
}

/** US-4.4 */
export class CreateActivityDto extends InteractionFields {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  activityTypeId!: string;

  @ApiProperty({ minLength: 1, maxLength: 200 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  /** Multi-day activities: the return date. */
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString({ strict: true })
  endsAt?: string | null;

  @ApiProperty({
    type: String,
    format: 'uuid',
    isArray: true,
    minItems: 1,
    maxItems: 50,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  participantIds!: string[];
}

export class TaskDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ type: String, format: 'date', nullable: true }) dueOn!:
    string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) doneAt!:
    string | null;
  @ApiProperty({ type: UserRefDto }) assignee!: UserRefDto;
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  interactionId!: string | null;
}

export class ActivityTypeRefDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() nameAr!: string;
  @ApiProperty() nameEn!: string;
  @ApiProperty({
    enum: ['PURPLE', 'NAVY', 'GREEN', 'AMBER', 'ROSE', 'SLATE'],
    enumName: 'LookupColor',
  })
  color!: 'PURPLE' | 'NAVY' | 'GREEN' | 'AMBER' | 'ROSE' | 'SLATE';
}

export class InteractionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['FOLLOW_UP', 'ACTIVITY'], enumName: 'InteractionKind' })
  kind!: 'FOLLOW_UP' | 'ACTIVITY';
  /** Derived from startsAt (BR-FU-3). */
  @ApiProperty({ enum: ['UPCOMING', 'DONE'], enumName: 'InteractionStatus' })
  status!: 'UPCOMING' | 'DONE';
  @ApiProperty({ type: String, nullable: true }) title!: string | null;
  @ApiProperty({ type: ActivityTypeRefDto, nullable: true })
  activityType!: ActivityTypeRefDto | null;
  @ApiProperty({ format: 'date-time' }) startsAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) endsAt!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) place!: string | null;
  @ApiProperty({ type: String, nullable: true }) sharedNotes!: string | null;
  /** Null for anyone but the creator and moderators, who are the only ones it's read for. */
  @ApiProperty({ type: String, nullable: true }) privateNotes!: string | null;
  @ApiProperty({ type: String, isArray: true }) challenges!: string[];
  @ApiProperty({ type: UserRefDto }) createdBy!: UserRefDto;
  /** The super admin who logged it while impersonating `createdBy` (BR-ADM-5). */
  @ApiProperty({ type: UserRefDto, nullable: true })
  impersonator!: UserRefDto | null;
  @ApiProperty({ type: UserRefDto, isArray: true }) participants!: UserRefDto[];
  @ApiProperty({ type: TaskDto, isArray: true }) tasks!: TaskDto[];
}

export class InteractionPageDto {
  @ApiProperty({ type: InteractionDto, isArray: true })
  items!: InteractionDto[];
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) nextCursor!:
    string | null;
}

export class TimelineQuery {
  /** Whose follow-ups and activities. */
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  userId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class TasksQuery {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  assigneeId!: string;

  @ApiPropertyOptional({ enum: ['open', 'all'], default: 'open' })
  @IsOptional()
  @IsIn(['open', 'all'])
  status?: 'open' | 'all';
}

export class UpdateTaskDto {
  @ApiProperty()
  @IsBoolean()
  done!: boolean;
}
