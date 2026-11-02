import { ApiProperty } from '@nestjs/swagger';
import { ROLES, type Role } from '@tarbya/shared';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { UserRefDto } from '../users/users.dto';

export class ProfileDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) email!: string | null;
  @ApiProperty({ type: String, nullable: true }) phone!: string | null;
  @ApiProperty({ enum: ROLES, enumName: 'Role', isArray: true }) roles!: Role[];
  @ApiProperty({ type: UserRefDto, nullable: true })
  manager!: UserRefDto | null;
  @ApiProperty({ type: UserRefDto, nullable: true }) mentor!: UserRefDto | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  deactivatedAt!: string | null;
  /** The viewer manages, mentors or administers this user (never true for the user themself). */
  @ApiProperty() canSeeAdminNotes!: boolean;
  /** The member themself, their current mentor, or an admin. */
  @ApiProperty() canSeePlans!: boolean;
  /** Their current mentor or an admin (BR-PLAN-2). */
  @ApiProperty() canManagePlans!: boolean;
}

export class AdminNoteDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() body!: string;
  @ApiProperty({ type: UserRefDto }) author!: UserRefDto;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
  /** Only the author edits a note. */
  @ApiProperty() canEdit!: boolean;
}

export class AdminNoteBodyDto {
  @ApiProperty({ minLength: 1, maxLength: 5000 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;
}
