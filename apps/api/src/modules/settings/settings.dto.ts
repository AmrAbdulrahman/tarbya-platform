import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SIGN_IN_ROLES, type Role, type Settings } from '@tarbya/shared';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

/** The settings with API-friendly names; `toSettings`/`fromSettings` map to the stored keys. */
export class SettingsDto {
  @ApiProperty({ enum: SIGN_IN_ROLES, enumName: 'SignInRole', isArray: true })
  signInRoles!: Role[];

  @ApiProperty({ minimum: 1, maximum: 90 })
  contactDueDays!: number;

  @ApiProperty({ minimum: 2, maximum: 180 })
  contactLateDays!: number;

  @ApiProperty({ minimum: 1, maximum: 336 })
  rsvpRequestHours!: number;

  @ApiProperty({ minimum: 1, maximum: 72 })
  reminderHours!: number;

  @ApiProperty({ minimum: 2, maximum: 10 })
  trendWindow!: number;

  @ApiProperty({ minimum: 0, maximum: 0.5 })
  trendSteadyBand!: number;

  @ApiProperty({ minimum: 1, maximum: 90 })
  checkInDays!: number;
}

export class UpdateSettingsDto {
  @ApiPropertyOptional({
    enum: SIGN_IN_ROLES,
    enumName: 'SignInRole',
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(SIGN_IN_ROLES, { each: true })
  signInRoles?: Role[];

  @ApiPropertyOptional({ minimum: 1, maximum: 90 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  contactDueDays?: number;

  @ApiPropertyOptional({ minimum: 2, maximum: 180 })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(180)
  contactLateDays?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 336 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(336)
  rsvpRequestHours?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 72 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(72)
  reminderHours?: number;

  @ApiPropertyOptional({ minimum: 2, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(10)
  trendWindow?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 0.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.5)
  trendSteadyBand?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 90 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  checkInDays?: number;
}

const keyOf = {
  signInRoles: 'auth.signInRoles',
  contactDueDays: 'contact.dueDays',
  contactLateDays: 'contact.lateDays',
  rsvpRequestHours: 'gatherings.rsvpRequestHours',
  reminderHours: 'gatherings.reminderHours',
  trendWindow: 'plans.trendWindow',
  trendSteadyBand: 'plans.trendSteadyBand',
  checkInDays: 'plans.checkInDays',
} as const satisfies Record<keyof SettingsDto, keyof Settings>;

export function fromSettings(settings: Settings): SettingsDto {
  const out = {} as Record<string, unknown>;
  for (const [field, key] of Object.entries(keyOf)) out[field] = settings[key];
  return out as unknown as SettingsDto;
}

export function toSettings(dto: UpdateSettingsDto): Partial<Settings> {
  const out: Record<string, unknown> = {};
  for (const [field, key] of Object.entries(keyOf)) {
    const value = dto[field as keyof UpdateSettingsDto];
    if (value !== undefined) out[key] = value;
  }
  return out as Partial<Settings>;
}
