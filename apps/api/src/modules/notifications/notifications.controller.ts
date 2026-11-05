import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentAuth, type AuthContext } from '../../common/auth-context';
import {
  NotificationPageDto,
  NotificationsQuery,
  PreferenceDto,
  UnreadCountDto,
  UpdatePreferencesDto,
} from './notifications.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  /** US-7.1: newest first, filtered by all, unread, my mentees, my journey or groups. */
  @Get()
  @ApiOkResponse({ type: NotificationPageDto })
  list(
    @CurrentAuth() auth: AuthContext,
    @Query() query: NotificationsQuery,
  ): Promise<NotificationPageDto> {
    return this.notifications.list(auth.userId, query);
  }

  /** The bell's badge. */
  @Get('unread-count')
  @ApiOkResponse({ type: UnreadCountDto })
  async unreadCount(@CurrentAuth() auth: AuthContext): Promise<UnreadCountDto> {
    return { count: await this.notifications.unreadCount(auth.userId) };
  }

  @Post('read-all')
  @HttpCode(204)
  @ApiNoContentResponse()
  readAll(@CurrentAuth() auth: AuthContext): Promise<void> {
    return this.notifications.markAllRead(auth.userId);
  }

  @Post(':id/read')
  @HttpCode(204)
  @ApiNoContentResponse()
  read(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.notifications.markRead(auth.userId, id);
  }

  /** US-2.4: in-app and email per type; mandatory types stay on in-app. */
  @Get('preferences')
  @ApiOkResponse({ type: PreferenceDto, isArray: true })
  preferences(@CurrentAuth() auth: AuthContext): Promise<PreferenceDto[]> {
    return this.notifications.preferences(auth.userId);
  }

  @Put('preferences')
  @ApiOkResponse({ type: PreferenceDto, isArray: true })
  updatePreferences(
    @CurrentAuth() auth: AuthContext,
    @Body() body: UpdatePreferencesDto,
  ): Promise<PreferenceDto[]> {
    return this.notifications.updatePreferences(auth.userId, body.changes);
  }
}
