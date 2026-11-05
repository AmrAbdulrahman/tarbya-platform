import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentAuth, type AuthContext } from '../../common/auth-context';
import {
  ConversationDto,
  MessageDto,
  MessagePageDto,
  MessagesQuery,
  SendMessageDto,
  UnreadDto,
} from './messages.dto';
import { MessagesService } from './messages.service';

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
    return this.messages.send(auth.userId, conversationId, body.body);
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
