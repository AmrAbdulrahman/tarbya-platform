import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
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
import { ActivityTypeRefDto } from '../interactions/interactions.dto';
import { ACTIVITY_SCOPES, LOOKUP_COLORS } from '../lookups/lookups.dto';
import { PersonRefDto, UserRefDto } from '../users/users.dto';

export const GROUP_ROLES = ['ADMIN', 'MODERATOR', 'MEMBER'] as const;
export type GroupRole = (typeof GROUP_ROLES)[number];
/** Roles given through membership; the admin changes only by handover. */
const ASSIGNABLE_ROLES = ['MODERATOR', 'MEMBER'] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];
export const RSVP_RESPONSES = ['ATTENDING', 'NOT_ATTENDING'] as const;
export type RsvpResponse = (typeof RSVP_RESPONSES)[number];
type Color = (typeof LOOKUP_COLORS)[number];

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const blankToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

/** A gathering type or group activity type, with what it asks of members. */
export class GatheringTypeDto extends ActivityTypeRefDto {
  @ApiProperty({ enum: ACTIVITY_SCOPES, enumName: 'ActivityScope' })
  scope!: (typeof ACTIVITY_SCOPES)[number];
  @ApiProperty() requiresRsvp!: boolean;
  @ApiProperty() tracksAttendance!: boolean;
  @ApiProperty({ enum: ['NONE', 'H3', 'H24', 'H48'], enumName: 'ReminderLead' })
  reminder!: 'NONE' | 'H3' | 'H24' | 'H48';
  /** Set for this group's own one-time activity types (BR-GRP-6). */
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  groupId!: string | null;
}

export class GroupMemberDto extends PersonRefDto {
  @ApiProperty({ enum: GROUP_ROLES, enumName: 'GroupRole' }) role!: GroupRole;
}

export class AttendanceCountsDto {
  @ApiProperty() members!: number;
  @ApiProperty() attending!: number;
  @ApiProperty() notAttending!: number;
  @ApiProperty() noReply!: number;
  /** Null until attendance is taken. */
  @ApiProperty({ type: Number, nullable: true }) present!: number | null;
}

/** One occurrence of a recurring gathering, or a one-time group activity. */
export class GatheringSummaryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) groupId!: string;
  @ApiProperty() groupName!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  seriesId!: string | null;
  @ApiProperty({ type: GatheringTypeDto }) activityType!: GatheringTypeDto;
  @ApiProperty({ type: String, nullable: true }) title!: string | null;
  @ApiProperty({ format: 'date-time' }) startsAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  endsAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) place!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  cancelledAt!: string | null;
  @ApiProperty({ type: AttendanceCountsDto }) counts!: AttendanceCountsDto;
  /** The viewer's own answer, when they are a member. */
  @ApiProperty({
    enum: RSVP_RESPONSES,
    enumName: 'RsvpResponse',
    nullable: true,
  })
  myRsvp!: RsvpResponse | null;
  /** The viewer is a member, so is asked to RSVP (the manager chain isn't, BR-GRP-4). */
  @ApiProperty() isMember!: boolean;
}

export class GatheringRowDto {
  @ApiProperty({ type: PersonRefDto }) member!: PersonRefDto;
  @ApiProperty({ enum: GROUP_ROLES, enumName: 'GroupRole' }) role!: GroupRole;
  @ApiProperty({
    enum: RSVP_RESPONSES,
    enumName: 'RsvpResponse',
    nullable: true,
  })
  rsvp!: RsvpResponse | null;
  /** Null until attendance is taken for this member. */
  @ApiProperty({ type: Boolean, nullable: true }) present!: boolean | null;
  @ApiProperty({ type: String, nullable: true }) note!: string | null;
}

/** A gathering with its RSVP and attendance log (BR-GRP-7, BR-GRP-8). */
export class GatheringDto extends GatheringSummaryDto {
  @ApiProperty({ type: GatheringRowDto, isArray: true })
  rows!: GatheringRowDto[];
  @ApiProperty() canManage!: boolean;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  remindedAt!: string | null;
}

export class GatheringPageDto {
  @ApiProperty({ type: GatheringSummaryDto, isArray: true })
  items!: GatheringSummaryDto[];
  /** Pass as `before` for the next page of past gatherings. */
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  nextCursor!: string | null;
}

export class SeriesDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ type: GatheringTypeDto }) activityType!: GatheringTypeDto;
  @ApiProperty({ type: String, nullable: true }) title!: string | null;
  /** 0 Sunday … 6 Saturday. */
  @ApiProperty({ minimum: 0, maximum: 6 }) weekday!: number;
  /** HH:mm, organisation time. */
  @ApiProperty() time!: string;
  @ApiProperty() intervalWeeks!: number;
  @ApiProperty() durationMinutes!: number;
  @ApiProperty({ type: String, nullable: true }) place!: string | null;
  @ApiProperty({ format: 'date' }) startsOn!: string;
  @ApiProperty({ type: String, format: 'date', nullable: true })
  endsOn!: string | null;
}

export class GroupSummaryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ type: PersonRefDto, nullable: true })
  admin!: PersonRefDto | null;
  @ApiProperty({ type: UserRefDto, isArray: true }) moderators!: UserRefDto[];
  /** The admin, moderators and members (BR-GRP-3); never the manager chain. */
  @ApiProperty() memberCount!: number;
  @ApiProperty({ enum: GROUP_ROLES, enumName: 'GroupRole', nullable: true })
  myRole!: GroupRole | null;
  @ApiProperty({ type: GatheringSummaryDto, nullable: true })
  nextGathering!: GatheringSummaryDto | null;
}

/** US-6.1…6.7 · design/screens/Group.dc.html */
export class GroupDto extends GroupSummaryDto {
  @ApiProperty({ type: GroupMemberDto, isArray: true })
  members!: GroupMemberDto[];
  /** Members, gatherings, attendance and reminders (BR-GRP-10). */
  @ApiProperty() canManage!: boolean;
  /** Hand over the admin role and appoint moderators (BR-GRP-2). */
  @ApiProperty() canManageRoles!: boolean;
  @ApiProperty({ type: SeriesDto, isArray: true }) series!: SeriesDto[];
  /** Gathering types, and the one-time activity types this group can use: organisation-wide and its own. */
  @ApiProperty({ type: GatheringTypeDto, isArray: true })
  activityTypes!: GatheringTypeDto[];
}

export class CreateGroupDto {
  @ApiProperty({ maxLength: 120 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ type: String, maxLength: 500, nullable: true })
  @IsOptional()
  @Transform(blankToNull)
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiProperty({ format: 'uuid' }) @IsUUID() adminId!: string;
}

export class UpdateGroupDto extends PartialType(
  OmitType(CreateGroupDto, ['adminId'] as const),
) {
  /** Archive (true) or restore (false). */
  @ApiPropertyOptional() @IsOptional() @IsBoolean() archived?: boolean;
}

export class AddMemberDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() userId!: string;

  @ApiPropertyOptional({
    enum: ASSIGNABLE_ROLES,
    enumName: 'AssignableGroupRole',
    default: 'MEMBER',
  })
  @IsOptional()
  @IsIn(ASSIGNABLE_ROLES)
  role?: AssignableRole;
}

export class SetMemberRoleDto {
  @ApiProperty({ enum: ASSIGNABLE_ROLES, enumName: 'AssignableGroupRole' })
  @IsIn(ASSIGNABLE_ROLES)
  role!: AssignableRole;
}

export class SetGroupAdminDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() userId!: string;
}

export class CreateSeriesDto {
  /** A GROUP_RECURRING activity type (the gathering type). */
  @ApiProperty({ format: 'uuid' }) @IsUUID() activityTypeId!: string;

  @ApiPropertyOptional({ type: String, maxLength: 120, nullable: true })
  @IsOptional()
  @Transform(blankToNull)
  @IsString()
  @MaxLength(120)
  title?: string | null;

  @ApiProperty({ minimum: 0, maximum: 6 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  weekday!: number;

  @ApiProperty({ example: '20:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  time!: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 8, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8)
  intervalWeeks?: number;

  @ApiPropertyOptional({ minimum: 15, maximum: 720, default: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(720)
  durationMinutes?: number;

  @ApiPropertyOptional({ type: String, maxLength: 200, nullable: true })
  @IsOptional()
  @Transform(blankToNull)
  @IsString()
  @MaxLength(200)
  place?: string | null;

  /** Defaults to today. */
  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  startsOn?: string;
}

export class UpdateSeriesDto extends PartialType(CreateSeriesDto) {}

export class CreateGatheringDto {
  /** A GROUP_ONE_OFF type: organisation-wide or this group's own. */
  @ApiProperty({ format: 'uuid' }) @IsUUID() activityTypeId!: string;

  @ApiProperty({ maxLength: 120 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @ApiProperty({ format: 'date-time' }) @IsDateString() startsAt!: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @ApiPropertyOptional({ type: String, maxLength: 200, nullable: true })
  @IsOptional()
  @Transform(blankToNull)
  @IsString()
  @MaxLength(200)
  place?: string | null;
}

/** Edit or cancel a single occurrence (US-6.3). */
export class UpdateGatheringDto {
  @ApiPropertyOptional({ type: String, maxLength: 120, nullable: true })
  @IsOptional()
  @Transform(blankToNull)
  @IsString()
  @MaxLength(120)
  title?: string | null;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ type: String, maxLength: 200, nullable: true })
  @IsOptional()
  @Transform(blankToNull)
  @IsString()
  @MaxLength(200)
  place?: string | null;

  /** Cancel (true) or restore (false). */
  @ApiPropertyOptional() @IsOptional() @IsBoolean() cancelled?: boolean;
}

export class RsvpDto {
  @ApiProperty({ enum: RSVP_RESPONSES, enumName: 'RsvpResponse' })
  @IsIn(RSVP_RESPONSES)
  response!: RsvpResponse;
}

export class AttendanceRowDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() userId!: string;
  @ApiProperty() @IsBoolean() present!: boolean;

  @ApiPropertyOptional({ type: String, maxLength: 300, nullable: true })
  @IsOptional()
  @Transform(blankToNull)
  @IsString()
  @MaxLength(300)
  note?: string | null;
}

export class SaveAttendanceDto {
  @ApiProperty({ type: AttendanceRowDto, isArray: true })
  @ValidateNested({ each: true })
  @ArrayMaxSize(500)
  @Type(() => AttendanceRowDto)
  rows!: AttendanceRowDto[];
}

export class RemindResultDto {
  /** Members who were sent a reminder. */
  @ApiProperty() notified!: number;
}

export class GatheringsQuery {
  @ApiProperty({ enum: ['upcoming', 'past'] })
  @IsIn(['upcoming', 'past'])
  when!: 'upcoming' | 'past';

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  before?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class CreateGroupActivityTypeDto {
  @ApiProperty({ maxLength: 80 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nameAr!: string;

  @ApiProperty({ maxLength: 80 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nameEn!: string;

  @ApiPropertyOptional({ enum: LOOKUP_COLORS, enumName: 'LookupColor' })
  @IsOptional()
  @IsIn(LOOKUP_COLORS)
  color?: Color;
}
