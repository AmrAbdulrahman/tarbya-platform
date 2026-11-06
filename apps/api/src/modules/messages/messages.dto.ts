import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PersonRefDto, UserRefDto } from '../users/users.dto';

const CONVERSATION_KINDS = ['DIRECT', 'GROUP', 'CHAT', 'TEAM'] as const;
/** How the other person relates to the viewer, for the list's second line. */
const RELATIONS = ['MY_MENTOR', 'MY_MENTEE'] as const;

/** A file sent in a conversation. */
export class AttachmentDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() mime!: string;
  /** Bytes. */
  @ApiProperty() size!: number;
  /** Where to load it; images open inline, other files download. */
  @ApiProperty() url!: string;
}

export class MessageDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) conversationId!: string;
  /** Empty when the message is only attachments. */
  @ApiProperty() body!: string;
  @ApiProperty({ type: AttachmentDto, isArray: true })
  attachments!: AttachmentDto[];
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
  /** DIRECT: null when they're neither my mentor nor my mentee. */
  @ApiProperty({
    enum: RELATIONS,
    enumName: 'ConversationRelation',
    nullable: true,
  })
  relation!: (typeof RELATIONS)[number] | null;
  /** GROUP: the group. */
  @ApiProperty({ type: UserRefDto, nullable: true }) group!: UserRefDto | null;
  /** CHAT: its name. */
  @ApiProperty({ type: String, nullable: true }) title!: string | null;
  /** GROUP and CHAT: how many take part. */
  @ApiProperty({ type: Number, nullable: true }) memberCount!: number | null;
  @ApiProperty({ type: LastMessageDto, nullable: true })
  lastMessage!: LastMessageDto | null;
  /** Messages from others since the viewer last read it. */
  @ApiProperty() unread!: number;
  /** False once the other person is deactivated: the history stays, read-only. */
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
  /** May be empty when attachments are sent. */
  @ApiProperty({ maxLength: 4000 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(4000)
  body!: string;

  /** Files uploaded to this conversation by the sender and not yet sent. */
  @ApiPropertyOptional({ type: String, format: 'uuid', isArray: true })
  @IsOptional()
  @IsUUID('all', { each: true })
  @ArrayMaxSize(10)
  attachmentIds?: string[];
}

export class ConversationRefDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
}

export class StartDirectDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  userId!: string;
}

export class ContactsQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  q?: string;
}

export class CreateChatDto {
  @ApiProperty({ minLength: 1, maxLength: 100 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title!: string;

  /** Everyone else to start with; the creator joins too. */
  @ApiProperty({ type: String, format: 'uuid', isArray: true })
  @IsUUID('all', { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  userIds!: string[];
}

export class AddMembersDto {
  @ApiProperty({ type: String, format: 'uuid', isArray: true })
  @IsUUID('all', { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  userIds!: string[];
}
