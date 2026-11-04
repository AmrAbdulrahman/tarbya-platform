import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ROLES, type Role } from '@tarbya/shared';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
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
} from 'class-validator';

const LOCALES = ['ar', 'en'] as const;
const CALENDARS = ['GREGORIAN', 'HIJRI', 'BOTH'] as const;
const PHONE = /^\+?[0-9][0-9 ()-]{5,19}$/;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
/** Empty strings clear an optional contact field. */
const trimOrNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export class UserRefDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;
}

/** A member shown with their picture. */
export class PersonRefDto extends UserRefDto {
  @ApiProperty({ type: String, nullable: true })
  avatarUrl!: string | null;
}

export class UserDto extends PersonRefDto {
  @ApiProperty({ type: String, nullable: true })
  email!: string | null;

  @ApiProperty({ type: String, nullable: true })
  phone!: string | null;

  @ApiProperty({ enum: LOCALES, enumName: 'Locale' })
  locale!: 'ar' | 'en';

  @ApiProperty({ enum: CALENDARS, enumName: 'CalendarPreference' })
  calendar!: 'GREGORIAN' | 'HIJRI' | 'BOTH';

  @ApiProperty()
  isModerator!: boolean;

  @ApiProperty({ enum: ROLES, enumName: 'Role', isArray: true })
  roles!: Role[];

  @ApiProperty({ type: UserRefDto, nullable: true })
  manager!: UserRefDto | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  deactivatedAt!: string | null;

  /** Active, has an email, and holds a role the sign-in setting allows (BR-AUTH-2). */
  @ApiProperty()
  canSignIn!: boolean;
}

export class UserPageDto {
  @ApiProperty({ type: UserDto, isArray: true })
  items!: UserDto[];

  @ApiProperty({ type: String, nullable: true, format: 'uuid' })
  nextCursor!: string | null;
}

export class ListUsersQuery {
  /** Typeahead over name, email and phone (BR-USR-6). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trim)
  q?: string;

  @ApiPropertyOptional({ enum: ['all', 'active', 'inactive'], default: 'all' })
  @IsOptional()
  @IsIn(['all', 'active', 'inactive'])
  status?: 'all' | 'active' | 'inactive';

  /** Only moderators and the super admin: the people who can be managers. */
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  moderatorsOnly?: boolean;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class CreateUserDto {
  @ApiProperty({ minLength: 1, maxLength: 120 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @Transform(trimOrNull)
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '+201001234567',
  })
  @IsOptional()
  @Transform(trimOrNull)
  @Matches(PHONE)
  phone?: string | null;

  @ApiPropertyOptional({ enum: LOCALES, enumName: 'Locale' })
  @IsOptional()
  @IsIn(LOCALES)
  locale?: 'ar' | 'en';

  @ApiPropertyOptional({ enum: CALENDARS, enumName: 'CalendarPreference' })
  @IsOptional()
  @IsIn(CALENDARS)
  calendar?: 'GREGORIAN' | 'HIJRI' | 'BOTH';
}

export class UpdateUserDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 120 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @Transform(trimOrNull)
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @Transform(trimOrNull)
  @Matches(PHONE)
  phone?: string | null;

  @ApiPropertyOptional({ enum: LOCALES, enumName: 'Locale' })
  @IsOptional()
  @IsIn(LOCALES)
  locale?: 'ar' | 'en';

  @ApiPropertyOptional({ enum: CALENDARS, enumName: 'CalendarPreference' })
  @IsOptional()
  @IsIn(CALENDARS)
  calendar?: 'GREGORIAN' | 'HIJRI' | 'BOTH';
}

/** Only moderators have managers, and only moderators or the super admin manage (BR-MGR-1). */
export class SetManagerDto {
  /** null makes the user top-level. */
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  managerId!: string | null;
}

export class SetModeratorDto {
  @ApiProperty()
  @IsBoolean()
  isModerator!: boolean;
}
