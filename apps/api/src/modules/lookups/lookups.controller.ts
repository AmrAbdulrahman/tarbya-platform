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
import { Requires } from '../../common/access';
import {
  ActivityTypeDto,
  CreateActivityTypeDto,
  UpdateActivityTypeDto,
} from './lookups.dto';
import { LookupsService } from './lookups.service';

/** Anyone signed in reads lookups (pickers filter out inactive ones); admins edit them. */
@ApiTags('lookups')
@Controller('lookups')
export class LookupsController {
  constructor(private readonly lookups: LookupsService) {}

  @Get('activity-types')
  @ApiOkResponse({ type: ActivityTypeDto, isArray: true })
  activityTypes(): Promise<ActivityTypeDto[]> {
    return this.lookups.activityTypes();
  }

  @Post('activity-types')
  @Requires('admin')
  @HttpCode(200)
  @ApiOkResponse({ type: ActivityTypeDto })
  createActivityType(
    @Body() body: CreateActivityTypeDto,
  ): Promise<ActivityTypeDto> {
    return this.lookups.createActivityType(body);
  }

  @Patch('activity-types/:id')
  @Requires('admin')
  @ApiOkResponse({ type: ActivityTypeDto })
  updateActivityType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateActivityTypeDto,
  ): Promise<ActivityTypeDto> {
    return this.lookups.updateActivityType(id, body);
  }
}
