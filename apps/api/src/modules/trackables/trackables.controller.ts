import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiConflictResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentAuth, type AuthContext } from '../../common/auth-context';
import {
  CreateTrackableDto,
  LogEntryDto,
  ReplyBodyDto,
  TrackableDetailDto,
  TrackablesQuery,
  TrackableSummaryDto,
  UpdateTrackableDto,
} from './trackables.dto';
import { TrackablesService } from './trackables.service';
import { SaveAsTemplateDto } from './templates.dto';
import { TrackableTemplatesService } from './templates.service';

@ApiTags('trackables')
@Controller('trackables')
export class TrackablesController {
  constructor(
    private readonly trackables: TrackablesService,
    private readonly templates: TrackableTemplatesService,
  ) {}

  @Get()
  @ApiOkResponse({ type: TrackableSummaryDto, isArray: true })
  list(
    @CurrentAuth() auth: AuthContext,
    @Query() query: TrackablesQuery,
  ): Promise<TrackableSummaryDto[]> {
    return this.trackables.list(auth.userId, query.menteeId);
  }

  @Get(':id')
  @ApiOkResponse({ type: TrackableDetailDto })
  get(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TrackableDetailDto> {
    return this.trackables.get(auth.userId, id);
  }

  /** US-4.5 */
  @Post()
  @HttpCode(200)
  @ApiOkResponse({ type: TrackableDetailDto })
  create(
    @CurrentAuth() auth: AuthContext,
    @Body() body: CreateTrackableDto,
  ): Promise<TrackableDetailDto> {
    return this.trackables.create(auth.userId, body);
  }

  @Patch(':id')
  @ApiOkResponse({ type: TrackableDetailDto })
  update(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateTrackableDto,
  ): Promise<TrackableDetailDto> {
    return this.trackables.update(auth.userId, id, body);
  }

  /** US-4.9: save to the library; the trackable then follows the template. */
  @Post(':id/template')
  @HttpCode(200)
  @ApiOkResponse({ type: TrackableDetailDto })
  @ApiConflictResponse({ description: 'TRACKABLE_FROM_TEMPLATE' })
  saveAsTemplate(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SaveAsTemplateDto,
  ): Promise<TrackableDetailDto> {
    return this.templates.saveFromTrackable(auth.userId, id, !!body.isPublic);
  }

  /** US-5.2: log (or replace) the cycle starting on `periodStart`. */
  @Put(':id/entries/:periodStart')
  @ApiOkResponse({ type: TrackableDetailDto })
  @ApiConflictResponse({
    description: 'TRACKABLE_ARCHIVED, CYCLE_OUT_OF_RANGE',
  })
  log(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('periodStart') periodStart: string,
    @Body() body: LogEntryDto,
  ): Promise<TrackableDetailDto> {
    return this.trackables.log(auth.userId, id, periodStart, body);
  }

  /** US-4.7 */
  @Post('entries/:entryId/replies')
  @HttpCode(200)
  @ApiOkResponse({ type: TrackableDetailDto })
  reply(
    @CurrentAuth() auth: AuthContext,
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Body() body: ReplyBodyDto,
  ): Promise<TrackableDetailDto> {
    return this.trackables.reply(auth.userId, entryId, body.body);
  }
}
