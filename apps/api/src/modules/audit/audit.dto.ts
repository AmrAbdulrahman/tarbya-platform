import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';
import { UserRefDto } from '../users/users.dto';
import { AUDIT_ACTIONS, type AuditAction } from './audit.service';

/** One audited change (BR-ADM-4). */
export class ChangeDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: AUDIT_ACTIONS, enumName: 'AuditAction' })
  action!: AuditAction;
  /** Who made the change; null for the system. */
  @ApiProperty({ type: UserRefDto, nullable: true }) actor!: UserRefDto | null;
  /** Whose account the actor was using: set when the super admin impersonated (BR-ADM-5). */
  @ApiProperty({ type: UserRefDto, nullable: true })
  onBehalfOf!: UserRefDto | null;
  /** The fields that changed, for updates. */
  @ApiProperty({ type: String, isArray: true }) fields!: string[];
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class ChangePageDto {
  @ApiProperty({ type: ChangeDto, isArray: true }) items!: ChangeDto[];
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  nextCursor!: string | null;
}

export class ChangesQuery {
  @ApiProperty({ format: 'uuid' }) @IsUUID() userId!: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  before?: string;
}
