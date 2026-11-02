import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentAuth, type AuthContext } from '../../common/auth-context';
import { AdminNoteBodyDto, AdminNoteDto, ProfileDto } from './profiles.dto';
import { ProfilesService } from './profiles.service';

@ApiTags('profiles')
@Controller()
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  /** The user themself, or someone responsible for them. */
  @Get('people/:id')
  @ApiOkResponse({ type: ProfileDto })
  get(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProfileDto> {
    return this.profiles.get(auth.userId, id);
  }

  @Get('people/:id/admin-notes')
  @ApiOkResponse({ type: AdminNoteDto, isArray: true })
  notes(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdminNoteDto[]> {
    return this.profiles.notes(auth.userId, id);
  }

  @Post('people/:id/admin-notes')
  @HttpCode(200)
  @ApiOkResponse({ type: AdminNoteDto })
  addNote(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AdminNoteBodyDto,
  ): Promise<AdminNoteDto> {
    return this.profiles.addNote(auth.userId, id, body.body);
  }

  @Patch('admin-notes/:id')
  @ApiOkResponse({ type: AdminNoteDto })
  editNote(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AdminNoteBodyDto,
  ): Promise<AdminNoteDto> {
    return this.profiles.editNote(auth.userId, id, body.body);
  }
}
