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
  Put,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentAuth, type AuthContext } from '../../common/auth-context';
import { GatheringsService } from './gatherings.service';
import {
  GatheringDto,
  GatheringSummaryDto,
  RemindResultDto,
  RsvpDto,
  SaveAttendanceDto,
  SeriesDto,
  UpdateGatheringDto,
  UpdateSeriesDto,
} from './groups.dto';

const id = new ParseUUIDPipe();

@ApiTags('gatherings')
@Controller()
export class GatheringsController {
  constructor(private readonly gatherings: GatheringsService) {}

  /** The signed-in member's upcoming gatherings across their groups (US-5.1). */
  @Get('gatherings/mine')
  @ApiOkResponse({ type: GatheringSummaryDto, isArray: true })
  mine(@CurrentAuth() auth: AuthContext): Promise<GatheringSummaryDto[]> {
    return this.gatherings.upcomingFor(auth.userId);
  }

  @Get('gatherings/:id')
  @ApiOkResponse({ type: GatheringDto })
  get(
    @CurrentAuth() auth: AuthContext,
    @Param('id', id) gatheringId: string,
  ): Promise<GatheringDto> {
    return this.gatherings.get(auth.userId, gatheringId);
  }

  @Patch('gatherings/:id')
  @ApiOkResponse({ type: GatheringDto })
  update(
    @CurrentAuth() auth: AuthContext,
    @Param('id', id) gatheringId: string,
    @Body() body: UpdateGatheringDto,
  ): Promise<GatheringDto> {
    return this.gatherings.update(auth.userId, gatheringId, body);
  }

  @Put('gatherings/:id/rsvp')
  @ApiOkResponse({ type: GatheringDto })
  rsvp(
    @CurrentAuth() auth: AuthContext,
    @Param('id', id) gatheringId: string,
    @Body() body: RsvpDto,
  ): Promise<GatheringDto> {
    return this.gatherings.rsvp(auth.userId, gatheringId, body.response);
  }

  @Put('gatherings/:id/attendance')
  @ApiOkResponse({ type: GatheringDto })
  attendance(
    @CurrentAuth() auth: AuthContext,
    @Param('id', id) gatheringId: string,
    @Body() body: SaveAttendanceDto,
  ): Promise<GatheringDto> {
    return this.gatherings.saveAttendance(auth.userId, gatheringId, body);
  }

  @Post('gatherings/:id/remind')
  @HttpCode(200)
  @ApiOkResponse({ type: RemindResultDto })
  remind(
    @CurrentAuth() auth: AuthContext,
    @Param('id', id) gatheringId: string,
  ): Promise<RemindResultDto> {
    return this.gatherings.remind(auth.userId, gatheringId);
  }

  @Patch('gathering-series/:id')
  @ApiOkResponse({ type: SeriesDto })
  updateSeries(
    @CurrentAuth() auth: AuthContext,
    @Param('id', id) seriesId: string,
    @Body() body: UpdateSeriesDto,
  ): Promise<SeriesDto> {
    return this.gatherings.updateSeries(auth.userId, seriesId, body);
  }

  @Delete('gathering-series/:id')
  @HttpCode(204)
  @ApiNoContentResponse()
  stopSeries(
    @CurrentAuth() auth: AuthContext,
    @Param('id', id) seriesId: string,
  ): Promise<void> {
    return this.gatherings.stopSeries(auth.userId, seriesId);
  }
}
