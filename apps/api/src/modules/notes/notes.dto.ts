import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRefDto } from '../users/users.dto';

const VISIBILITY = ['SHARED', 'PRIVATE'] as const;
type Visibility = (typeof VISIBILITY)[number];
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class NoteDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: VISIBILITY, enumName: 'NoteVisibility' })
  visibility!: Visibility;
  @ApiProperty() body!: string;
  @ApiProperty({ type: UserRefDto }) author!: UserRefDto;
  /** The super admin who wrote this while impersonating the author (BR-ADM-5). */
  @ApiProperty({ type: UserRefDto, nullable: true })
  impersonator!: UserRefDto | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class NotesQuery {
  @ApiProperty({ format: 'uuid' }) @IsUUID() menteeId!: string;
}

export class CreateNoteDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() menteeId!: string;

  @ApiProperty({ enum: VISIBILITY, enumName: 'NoteVisibility' })
  @IsIn(VISIBILITY)
  visibility!: Visibility;

  @ApiProperty({ minLength: 1, maxLength: 5000 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;
}

export class UpdateNoteDto {
  @ApiPropertyOptional({ enum: VISIBILITY, enumName: 'NoteVisibility' })
  @IsOptional()
  @IsIn(VISIBILITY)
  visibility?: Visibility;

  @ApiPropertyOptional({ minLength: 1, maxLength: 5000 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body?: string;

  /** Required to turn a private note into a shared one (US-4.6). */
  @ApiPropertyOptional() @IsOptional() @IsBoolean() confirmWiden?: boolean;
}
