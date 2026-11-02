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
import { ApiForbiddenResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentAuth, type AuthContext } from '../../common/auth-context';
import {
  CreateActivityDto,
  CreateFollowUpDto,
  InteractionDto,
  InteractionPageDto,
  TaskDto,
  TasksQuery,
  TimelineQuery,
  UpdateTaskDto,
} from './interactions.dto';
import { InteractionsService } from './interactions.service';
import { TasksService } from './tasks.service';

@ApiTags('interactions')
@Controller('interactions')
export class InteractionsController {
  constructor(private readonly interactions: InteractionsService) {}

  @Get()
  @ApiOkResponse({ type: InteractionPageDto })
  timeline(
    @CurrentAuth() auth: AuthContext,
    @Query() query: TimelineQuery,
  ): Promise<InteractionPageDto> {
    return this.interactions.timeline(auth.userId, query);
  }

  @Get(':id')
  @ApiOkResponse({ type: InteractionDto })
  get(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InteractionDto> {
    return this.interactions.get(auth.userId, id);
  }

  /** US-4.3 */
  @Post('follow-ups')
  @HttpCode(200)
  @ApiOkResponse({ type: InteractionDto })
  @ApiForbiddenResponse({ description: 'NOT_YOUR_MENTEE' })
  createFollowUp(
    @CurrentAuth() auth: AuthContext,
    @Body() body: CreateFollowUpDto,
  ): Promise<InteractionDto> {
    return this.interactions.createFollowUp(auth.userId, body);
  }

  /** US-4.4 */
  @Post('activities')
  @HttpCode(200)
  @ApiOkResponse({ type: InteractionDto })
  createActivity(
    @CurrentAuth() auth: AuthContext,
    @Body() body: CreateActivityDto,
  ): Promise<InteractionDto> {
    return this.interactions.createActivity(auth.userId, body);
  }
}

@ApiTags('tasks')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  @ApiOkResponse({ type: TaskDto, isArray: true })
  list(
    @CurrentAuth() auth: AuthContext,
    @Query() query: TasksQuery,
  ): Promise<TaskDto[]> {
    return this.tasks.list(auth.userId, query);
  }

  @Patch(':id')
  @ApiOkResponse({ type: TaskDto })
  update(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateTaskDto,
  ): Promise<TaskDto> {
    return this.tasks.setDone(auth.userId, id, body.done);
  }
}
