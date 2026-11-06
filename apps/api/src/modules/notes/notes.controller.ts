import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiConflictResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentAuth, type AuthContext } from '../../common/auth-context';
import {
  CreateNoteDto,
  NoteDto,
  NoteMentionAccessQuery,
  NotesQuery,
  UpdateNoteDto,
} from './notes.dto';
import { MentionAccessDto } from '../challenges/challenges.dto';
import { NotesService } from './notes.service';

@ApiTags('notes')
@Controller('notes')
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  @ApiOkResponse({ type: NoteDto, isArray: true })
  list(
    @CurrentAuth() auth: AuthContext,
    @Query() query: NotesQuery,
  ): Promise<NoteDto[]> {
    return this.notes.list(auth.userId, query.menteeId);
  }

  /** Who of the mentioned people couldn't read a note of this visibility. */
  @Get('mention-access')
  @ApiOkResponse({ type: MentionAccessDto })
  mentionAccess(
    @CurrentAuth() auth: AuthContext,
    @Query() query: NoteMentionAccessQuery,
  ): Promise<MentionAccessDto> {
    return this.notes.mentionAccess(
      auth.userId,
      query.menteeId,
      query.visibility,
      query.userIds,
    );
  }

  @Post()
  @HttpCode(200)
  @ApiOkResponse({ type: NoteDto })
  create(
    @CurrentAuth() auth: AuthContext,
    @Body() body: CreateNoteDto,
  ): Promise<NoteDto> {
    return this.notes.create(auth.userId, body);
  }

  @Patch(':id')
  @ApiOkResponse({ type: NoteDto })
  @ApiConflictResponse({ description: 'NOTE_WIDEN_CONFIRM' })
  update(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateNoteDto,
  ): Promise<NoteDto> {
    return this.notes.update(auth.userId, id, body);
  }
}
