import { ApiProperty } from '@nestjs/swagger';
import { ROLES, type Role } from '@tarbya/shared';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class PasswordSignInDto {
  @ApiProperty({ example: 'name@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;
}

export class RequestCodeDto {
  @ApiProperty({ example: 'name@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class CodeSignInDto extends RequestCodeDto {
  @ApiProperty({ example: '123456', pattern: '^\\d{6}$' })
  @Matches(/^\d{6}$/)
  code!: string;
}

export class MeDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  email!: string | null;

  @ApiProperty({ enum: ['ar', 'en'], enumName: 'Locale' })
  locale!: 'ar' | 'en';

  @ApiProperty({
    enum: ['GREGORIAN', 'HIJRI', 'BOTH'],
    enumName: 'CalendarPreference',
  })
  calendar!: 'GREGORIAN' | 'HIJRI' | 'BOTH';

  @ApiProperty({ enum: ROLES, enumName: 'Role', isArray: true })
  roles!: Role[];
}
