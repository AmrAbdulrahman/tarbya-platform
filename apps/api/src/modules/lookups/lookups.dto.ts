import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export const ACTIVITY_SCOPES = [
  'INDIVIDUAL',
  'GROUP_RECURRING',
  'GROUP_ONE_OFF',
] as const;
export const LOOKUP_COLORS = [
  'PURPLE',
  'NAVY',
  'GREEN',
  'AMBER',
  'ROSE',
  'SLATE',
] as const;
export const REMINDER_LEADS = ['NONE', 'H3', 'H24', 'H48'] as const;

type Scope = (typeof ACTIVITY_SCOPES)[number];
type Color = (typeof LOOKUP_COLORS)[number];
type Reminder = (typeof REMINDER_LEADS)[number];

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

class Names {
  @ApiProperty({ minLength: 1, maxLength: 80 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nameAr!: string;

  @ApiProperty({ minLength: 1, maxLength: 80 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nameEn!: string;
}

export class ActivityTypeDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() nameAr!: string;
  @ApiProperty() nameEn!: string;
  @ApiProperty({ enum: ACTIVITY_SCOPES, enumName: 'ActivityScope' })
  scope!: Scope;
  @ApiProperty({ enum: LOOKUP_COLORS, enumName: 'LookupColor' }) color!: Color;
  @ApiProperty() requiresRsvp!: boolean;
  @ApiProperty() tracksAttendance!: boolean;
  @ApiProperty() showInFeed!: boolean;
  @ApiProperty({ enum: REMINDER_LEADS, enumName: 'ReminderLead' })
  reminder!: Reminder;
  @ApiProperty() active!: boolean;
}

export class CreateActivityTypeDto extends Names {
  @ApiProperty({ enum: ACTIVITY_SCOPES, enumName: 'ActivityScope' })
  @IsIn(ACTIVITY_SCOPES)
  scope!: Scope;

  @ApiPropertyOptional({ enum: LOOKUP_COLORS, enumName: 'LookupColor' })
  @IsOptional()
  @IsIn(LOOKUP_COLORS)
  color?: Color;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() requiresRsvp?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() tracksAttendance?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() showInFeed?: boolean;

  @ApiPropertyOptional({ enum: REMINDER_LEADS, enumName: 'ReminderLead' })
  @IsOptional()
  @IsIn(REMINDER_LEADS)
  reminder?: Reminder;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateActivityTypeDto extends PartialType(CreateActivityTypeDto) {}
