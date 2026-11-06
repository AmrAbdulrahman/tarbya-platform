import { ApiProperty } from '@nestjs/swagger';
import { ROLES, type Role } from '@tarbya/shared';
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
  /** The viewer is above this member (mentoring chain, management line) or an admin: reads every note and writes them (BR-NOTE-1, BR-NOTE-3). */
  @ApiProperty() canWriteNotes!: boolean;
  /** The member themself, their current mentor, or an admin: trackables, challenges, tasks, history. */
  @ApiProperty() canSeeMentoring!: boolean;
  /** Their current mentor or an admin: creates trackables, challenges and tasks (BR-TRK-6). */
  @ApiProperty() canManageMentoring!: boolean;
  /** The viewer is their current mentor: logs follow-ups and writes notes (US-4.3, US-4.6). */
  @ApiProperty() isMentor!: boolean;
}
