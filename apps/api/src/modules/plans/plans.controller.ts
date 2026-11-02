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
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentAuth, type AuthContext } from '../../common/auth-context';
import {
  CheckInDto,
  CreatePlanDto,
  PlanDetailDto,
  PlanReplyBodyDto,
  PlansQuery,
  PlanSummaryDto,
  UpdatePlanDto,
} from './plans.dto';
import { PlansService } from './plans.service';

@ApiTags('plans')
@Controller('plans')
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  @ApiOkResponse({ type: PlanSummaryDto, isArray: true })
  list(
    @CurrentAuth() auth: AuthContext,
    @Query() query: PlansQuery,
  ): Promise<PlanSummaryDto[]> {
    return this.plans.list(auth.userId, query.menteeId);
  }

  @Get(':id')
  @ApiOkResponse({ type: PlanDetailDto })
  get(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PlanDetailDto> {
    return this.plans.get(auth.userId, id);
  }

  /** US-4.5 */
  @Post()
  @HttpCode(200)
  @ApiOkResponse({ type: PlanDetailDto })
  create(
    @CurrentAuth() auth: AuthContext,
    @Body() body: CreatePlanDto,
  ): Promise<PlanDetailDto> {
    return this.plans.create(auth.userId, body);
  }

  @Patch(':id')
  @ApiOkResponse({ type: PlanDetailDto })
  update(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdatePlanDto,
  ): Promise<PlanDetailDto> {
    return this.plans.update(auth.userId, id, body);
  }

  /** US-5.2 */
  @Post(':id/check-ins')
  @HttpCode(200)
  @ApiOkResponse({ type: PlanDetailDto })
  checkIn(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CheckInDto,
  ): Promise<PlanDetailDto> {
    return this.plans.checkIn(auth.userId, id, body);
  }

  /** US-4.7 */
  @Post('readings/:readingId/replies')
  @HttpCode(200)
  @ApiOkResponse({ type: PlanDetailDto })
  reply(
    @CurrentAuth() auth: AuthContext,
    @Param('readingId', ParseUUIDPipe) readingId: string,
    @Body() body: PlanReplyBodyDto,
  ): Promise<PlanDetailDto> {
    return this.plans.reply(auth.userId, readingId, body.body);
  }
}
