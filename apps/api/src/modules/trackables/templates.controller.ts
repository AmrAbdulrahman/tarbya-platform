import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentAuth, type AuthContext } from '../../common/auth-context';
import { TrackableDetailDto } from './trackables.dto';
import {
  AssignTemplateDto,
  TemplatesQuery,
  TrackableTemplateDto,
  UpdateTemplateDto,
} from './templates.dto';
import { TrackableTemplatesService } from './templates.service';

/** US-4.9: the trackable library. */
@ApiTags('trackables')
@Controller('trackable-templates')
export class TrackableTemplatesController {
  constructor(private readonly templates: TrackableTemplatesService) {}

  @Get()
  @ApiOkResponse({ type: TrackableTemplateDto, isArray: true })
  list(
    @CurrentAuth() auth: AuthContext,
    @Query() query: TemplatesQuery,
  ): Promise<TrackableTemplateDto[]> {
    return this.templates.list(auth.userId, query.menteeId);
  }

  @Patch(':id')
  @ApiOkResponse({ type: TrackableTemplateDto })
  @ApiConflictResponse({ description: 'TRACKABLE_HAS_ENTRIES' })
  update(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateTemplateDto,
  ): Promise<TrackableTemplateDto> {
    return this.templates.update(auth.userId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  remove(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.templates.remove(auth.userId, id);
  }

  @Post(':id/assign')
  @HttpCode(200)
  @ApiOkResponse({ type: TrackableDetailDto })
  @ApiConflictResponse({ description: 'TEMPLATE_ALREADY_ASSIGNED' })
  assign(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AssignTemplateDto,
  ): Promise<TrackableDetailDto> {
    return this.templates.assign(auth.userId, id, body);
  }
}
