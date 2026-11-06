import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AppException } from '../../common/app-exception';
import { CurrentAuth, type AuthContext } from '../../common/auth-context';
import { PersonRefDto } from '../users/users.dto';
import {
  AddMembersDto,
  AttachmentDto,
  ContactsQuery,
  CreateChatDto,
  ConversationDto,
  ConversationRefDto,
  MessageDto,
  MessagePageDto,
  MessagesQuery,
  SendMessageDto,
  StartDirectDto,
  UnreadDto,
} from './messages.dto';
import { ATTACHMENT_MAX_BYTES, MessagesService } from './messages.service';

const id = new ParseUUIDPipe();

@ApiTags('messages')
@Controller('conversations')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  @ApiOkResponse({ type: ConversationDto, isArray: true })
  list(@CurrentAuth() auth: AuthContext): Promise<ConversationDto[]> {
    return this.messages.list(auth.userId);
  }

  /** The header badge (US-7.3). */
  @Get('unread')
  @ApiOkResponse({ type: UnreadDto })
  unread(@CurrentAuth() auth: AuthContext): Promise<UnreadDto> {
    return this.messages.unread(auth.userId);
  }

  /** People the user can start a conversation with: any active member. */
  @Get('contacts')
  @ApiOkResponse({ type: PersonRefDto, isArray: true })
  contacts(
    @CurrentAuth() auth: AuthContext,
    @Query() query: ContactsQuery,
  ): Promise<PersonRefDto[]> {
    return this.messages.contacts(auth.userId, query.q);
  }

  /** Opens (or finds) the one-to-one conversation with a member. */
  @Post('direct')
  @HttpCode(200)
  @ApiOkResponse({ type: ConversationRefDto })
  direct(
    @CurrentAuth() auth: AuthContext,
    @Body() body: StartDirectDto,
  ): Promise<ConversationRefDto> {
    return this.messages.direct(auth.userId, body.userId);
  }

  /** Starts a group chat with the people picked (BR-MSG-4). */
  @Post('chats')
  @HttpCode(200)
  @ApiOkResponse({ type: ConversationRefDto })
  createChat(
    @CurrentAuth() auth: AuthContext,
    @Body() body: CreateChatDto,
  ): Promise<ConversationRefDto> {
    return this.messages.createChat(auth.userId, body.title, body.userIds);
  }

  /** Who takes part: a direct's pair, a group's members, a chat's members. */
  @Get(':id/members')
  @ApiOkResponse({ type: PersonRefDto, isArray: true })
  members(
    @CurrentAuth() auth: AuthContext,
    @Param('id', id) conversationId: string,
  ): Promise<PersonRefDto[]> {
    return this.messages.members(auth.userId, conversationId);
  }

  /** Any member of a chat adds people; they see messages from now on. */
  @Post(':id/members')
  @HttpCode(204)
  @ApiNoContentResponse()
  addMembers(
    @CurrentAuth() auth: AuthContext,
    @Param('id', id) conversationId: string,
    @Body() body: AddMembersDto,
  ): Promise<void> {
    return this.messages.addMembers(auth.userId, conversationId, body.userIds);
  }

  /** Leaves a chat. */
  @Delete(':id/members/me')
  @HttpCode(204)
  @ApiNoContentResponse()
  leave(
    @CurrentAuth() auth: AuthContext,
    @Param('id', id) conversationId: string,
  ): Promise<void> {
    return this.messages.leave(auth.userId, conversationId);
  }

  @Get(':id/messages')
  @ApiOkResponse({ type: MessagePageDto })
  page(
    @CurrentAuth() auth: AuthContext,
    @Param('id', id) conversationId: string,
    @Query() query: MessagesQuery,
  ): Promise<MessagePageDto> {
    return this.messages.messages(auth.userId, conversationId, query);
  }

  @Post(':id/messages')
  @HttpCode(200)
  @ApiOkResponse({ type: MessageDto })
  send(
    @CurrentAuth() auth: AuthContext,
    @Param('id', id) conversationId: string,
    @Body() body: SendMessageDto,
  ): Promise<MessageDto> {
    return this.messages.send(
      auth.userId,
      conversationId,
      body.body,
      body.attachmentIds,
    );
  }

  /** Uploads a file to send in the next message (up to 20 MB). */
  @Post(':id/attachments')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: ATTACHMENT_MAX_BYTES, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiOkResponse({ type: AttachmentDto })
  upload(
    @CurrentAuth() auth: AuthContext,
    @Param('id', id) conversationId: string,
    @UploadedFile()
    file:
      { buffer: Buffer; originalname: string; mimetype: string } | undefined,
  ): Promise<AttachmentDto> {
    if (!file)
      throw new AppException(400, {
        code: 'VALIDATION_FAILED',
        title: 'Attach a file as "file"',
      });
    return this.messages.upload(auth.userId, conversationId, file);
  }

  /** A file from the conversation: images inline, anything else as a download. */
  @Get(':id/attachments/:attachmentId')
  @Header('Cache-Control', 'private, max-age=86400')
  @ApiOkResponse({ description: 'The file' })
  async attachment(
    @CurrentAuth() auth: AuthContext,
    @Param('id', id) conversationId: string,
    @Param('attachmentId', id) attachmentId: string,
  ): Promise<StreamableFile> {
    const file = await this.messages.attachment(
      auth.userId,
      conversationId,
      attachmentId,
    );
    return new StreamableFile(file.stream, {
      type: file.inline ? file.mime : 'application/octet-stream',
      disposition: `${file.inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    });
  }

  @Post(':id/read')
  @HttpCode(204)
  @ApiNoContentResponse()
  read(
    @CurrentAuth() auth: AuthContext,
    @Param('id', id) conversationId: string,
  ): Promise<void> {
    return this.messages.markRead(auth.userId, conversationId);
  }
}
