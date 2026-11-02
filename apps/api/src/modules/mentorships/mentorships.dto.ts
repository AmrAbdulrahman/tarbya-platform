import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { UserRefDto } from '../users/users.dto';

export class MentorRefDto extends UserRefDto {
  /** Their direct manager, if any: shown as "reports to" in the mentoring tree. */
  @ApiProperty({ type: UserRefDto, nullable: true })
  manager!: UserRefDto | null;
}

export class MentorshipDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ type: MentorRefDto }) mentor!: MentorRefDto;
  @ApiProperty({ type: UserRefDto }) mentee!: UserRefDto;
  @ApiProperty({ format: 'date-time' }) startedAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) endedAt!:
    string | null;
}

export class AssignMentorshipDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() mentorId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() menteeId!: string;

  /** End the mentee's current mentorship and start this one (US-3.3). */
  @ApiPropertyOptional() @IsOptional() @IsBoolean() replace?: boolean;
}

const CONTACT = ['REGULAR', 'DUE', 'LATE'] as const;

export class MyMenteeDto {
  @ApiProperty({ format: 'uuid' }) mentorshipId!: string;
  @ApiProperty({ type: UserRefDto }) mentee!: UserRefDto;
  @ApiProperty({ format: 'date-time' }) startedAt!: string;

  /** The last done follow-up or activity with this mentee, if any (BR-FU-5). */
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastContactAt!: string | null;

  @ApiProperty({ enum: CONTACT, enumName: 'ContactStatus' })
  contactStatus!: (typeof CONTACT)[number];
  @ApiProperty() daysSinceContact!: number;
  @ApiProperty() openTasks!: number;
}

export class MyMentoringDto {
  @ApiProperty({ type: UserRefDto, nullable: true }) mentor!: UserRefDto | null;
  @ApiProperty({ type: MyMenteeDto, isArray: true }) mentees!: MyMenteeDto[];
}
