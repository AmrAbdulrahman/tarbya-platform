import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PersonRefDto, UserRefDto } from '../users/users.dto';

const CONVERSATION_KINDS = ['DIRECT', 'GROUP', 'TEAM'] as const;
/** How the other person relates to the viewer, for the list's second line. */
const RELATIONS = ['MY_MENTOR', 'MY_MENTEE', 'FORMER'] as const;

export class MessageDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) conversationId!: string;
  @ApiProperty() body!: string;
  @ApiProperty({ type: PersonRefDto }) author!: PersonRefDto;
  /** The super admin who wrote this while impersonating the author (BR-ADM-5). */
  @ApiProperty({ type: UserRefDto, nullable: true })
  impersonator!: UserRefDto | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class LastMessageDto {
  @ApiProperty() body!: string;
  @ApiProperty({ type: UserRefDto }) author!: UserRefDto;
  @ApiProperty({ format: 'date-time' }) at!: string;
}

/** One row of the conversation list (design/screens/Messages.dc.html). */
export class ConversationDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: CONVERSATION_KINDS, enumName: 'ConversationKind' })
  kind!: (typeof CONVERSATION_KINDS)[number];
  /** DIRECT: the other person. */
  @ApiProperty({ type: PersonRefDto, nullable: true })
  other!: PersonRefDto | null;
  @ApiProperty({
    enum: RELATIONS,
    enumName: 'ConversationRelation',
    nullable: true,
  })
  relation!: (typeof RELATIONS)[number] | null;
  /** GROUP: the group and its size. */
  @ApiProperty({ type: UserRefDto, nullable: true }) group!: UserRefDto | null;
  @ApiProperty({ type: Number, nullable: true }) memberCount!: number | null;
  @ApiProperty({ type: LastMessageDto, nullable: true })
  lastMessage!: LastMessageDto | null;
  /** Messages from others since the viewer last read it. */
  @ApiProperty() unread!: number;
  /** False once the mentorship has ended: the history stays, read-only. */
  @ApiProperty() canPost!: boolean;
}

export class UnreadDto {
  /** Conversations with something unread: the header badge. */
  @ApiProperty() conversations!: number;
}

export class MessagePageDto {
  /** Newest first. */
  @ApiProperty({ type: MessageDto, isArray: true }) items!: MessageDto[];
  /** Pass as `before` for older messages. */
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  nextCursor!: string | null;
}

export class MessagesQuery {
  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  before?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class SendMessageDto {
  @ApiProperty({ maxLength: 4000 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}
