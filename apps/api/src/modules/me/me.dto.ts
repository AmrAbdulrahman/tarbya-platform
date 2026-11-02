import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const LOCALES = ['ar', 'en'] as const;
const CALENDARS = ['GREGORIAN', 'HIJRI', 'BOTH'] as const;
const KINDS = ['EMAIL', 'PHONE'] as const;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class MyProfileDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) email!: string | null;
  @ApiProperty({ type: String, nullable: true }) phone!: string | null;
  @ApiProperty({ enum: LOCALES, enumName: 'Locale' }) locale!: 'ar' | 'en';
  @ApiProperty({ enum: CALENDARS, enumName: 'CalendarPreference' }) calendar!:
    'GREGORIAN' | 'HIJRI' | 'BOTH';
  @ApiProperty({ type: String, nullable: true }) avatarUrl!: string | null;
  @ApiProperty() hasPassword!: boolean;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  passwordChangedAt!: string | null;
}

/** US-2.1 */
export class UpdateMyProfileDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 120 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ enum: LOCALES, enumName: 'Locale' })
  @IsOptional()
  @IsIn(LOCALES)
  locale?: 'ar' | 'en';

  @ApiPropertyOptional({ enum: CALENDARS, enumName: 'CalendarPreference' })
  @IsOptional()
  @IsIn(CALENDARS)
  calendar?: 'GREGORIAN' | 'HIJRI' | 'BOTH';
}

/** US-2.2: step one, ask for a code. */
export class RequestContactChangeDto {
  @ApiProperty({ enum: KINDS, enumName: 'ContactKind' })
  @IsIn(KINDS)
  kind!: 'EMAIL' | 'PHONE';

  @ApiProperty({ maxLength: 254 })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(254)
  value!: string;
}

/** US-2.2: step two, confirm it. */
export class ConfirmContactChangeDto {
  @ApiProperty({ enum: KINDS, enumName: 'ContactKind' })
  @IsIn(KINDS)
  kind!: 'EMAIL' | 'PHONE';

  @ApiProperty({ pattern: '^\\d{6}$' })
  @Matches(/^\d{6}$/)
  code!: string;
}

/** US-2.3 */
export class ChangePasswordDto {
  /** Required when the user already has a password. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  currentPassword?: string;

  @ApiProperty({ minLength: 10, maxLength: 200 })
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  newPassword!: string;
}
