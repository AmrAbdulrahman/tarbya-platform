import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRefDto } from '../users/users.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ChallengeCommentDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() body!: string;
  @ApiProperty({ type: UserRefDto }) author!: UserRefDto;
  /** The super admin who wrote this while impersonating the author (BR-ADM-5). */
  @ApiProperty({ type: UserRefDto, nullable: true })
  impersonator!: UserRefDto | null;
  /** The follow-up it was written in, if any. */
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  interactionId!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

/** BR-CHL-1…3 */
export class ChallengeDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) menteeId!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ type: UserRefDto }) createdBy!: UserRefDto;
  /** The super admin who wrote this while impersonating the author (BR-ADM-5). */
  @ApiProperty({ type: UserRefDto, nullable: true })
  impersonator!: UserRefDto | null;
  /** The follow-up it was raised in, if any. */
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  interactionId!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  resolvedAt!: string | null;
  @ApiProperty({ type: UserRefDto, nullable: true })
  resolvedBy!: UserRefDto | null;
  /** Oldest first. */
  @ApiProperty({ type: ChallengeCommentDto, isArray: true })
  comments!: ChallengeCommentDto[];
}

export class ChallengesQuery {
  @ApiProperty({ format: 'uuid' }) @IsUUID() menteeId!: string;
}

export class CreateChallengeDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() menteeId!: string;

  @ApiProperty({ maxLength: 300 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;
}

export class UpdateChallengeDto {
  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title?: string;

  /** Resolve (true) or reopen (false). */
  @ApiPropertyOptional() @IsOptional() @IsBoolean() resolved?: boolean;
}

export class CommentBodyDto {
  @ApiProperty({ maxLength: 2000 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;
}
