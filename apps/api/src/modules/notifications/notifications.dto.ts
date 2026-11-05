import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { NOTIFICATION_TYPES, type NotificationType } from '@tarbya/shared';

const CATEGORIES = ['mentees', 'journey', 'groups', 'other'] as const;
const FILTERS = ['all', 'unread', 'mentees', 'journey', 'groups'] as const;

/** One notification (BR-NTF-3). `payload` carries what its text and link need. */
export class NotificationDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: NOTIFICATION_TYPES, enumName: 'NotificationType' })
  type!: NotificationType;
  @ApiProperty({ enum: CATEGORIES, enumName: 'NotificationCategory' })
  category!: (typeof CATEGORIES)[number];
  @ApiProperty({ type: 'object', additionalProperties: true })
  payload!: Record<string, unknown>;
  /** Where it leads in the app. */
  @ApiProperty() link!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  readAt!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class NotificationPageDto {
  @ApiProperty({ type: NotificationDto, isArray: true })
  items!: NotificationDto[];
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  nextCursor!: string | null;
}

export class NotificationsQuery {
  @ApiPropertyOptional({ enum: FILTERS, default: 'all' })
  @IsOptional()
  @IsIn(FILTERS)
  filter?: (typeof FILTERS)[number];

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  before?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class UnreadCountDto {
  @ApiProperty() count!: number;
}

export class PreferenceDto {
  @ApiProperty({ enum: NOTIFICATION_TYPES, enumName: 'NotificationType' })
  type!: NotificationType;
  @ApiProperty() inApp!: boolean;
  @ApiProperty() email!: boolean;
  /** Always delivered in-app; the toggle is locked on (US-2.4). */
  @ApiProperty() mandatory!: boolean;
}

export class PreferenceChangeDto {
  @ApiProperty({ enum: NOTIFICATION_TYPES, enumName: 'NotificationType' })
  @IsIn(NOTIFICATION_TYPES)
  type!: NotificationType;
  @ApiProperty() @IsBoolean() inApp!: boolean;
  @ApiProperty() @IsBoolean() email!: boolean;
}

export class UpdatePreferencesDto {
  @ApiProperty({ type: PreferenceChangeDto, isArray: true })
  @ValidateNested({ each: true })
  @ArrayMaxSize(NOTIFICATION_TYPES.length)
  @Type(() => PreferenceChangeDto)
  changes!: PreferenceChangeDto[];
}
