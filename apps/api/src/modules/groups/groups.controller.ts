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
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Requires } from '../../common/access';
import { CurrentAuth, type AuthContext } from '../../common/auth-context';
import { GatheringsService } from './gatherings.service';
import {
  AddMemberDto,
  CreateGatheringDto,
  CreateGroupActivityTypeDto,
  CreateGroupDto,
  CreateSeriesDto,
  GatheringDto,
  GatheringPageDto,
  GatheringsQuery,
  GatheringTypeDto,
  GroupDto,
  GroupSummaryDto,
  SeriesDto,
  SetGroupAdminDto,
  SetMemberRoleDto,
  UpdateGroupDto,
} from './groups.dto';
import { GroupsService } from './groups.service';

const id = new ParseUUIDPipe();

@ApiTags('groups')
@Controller('groups')
export class GroupsController {
  constructor(
    private readonly groups: GroupsService,
    private readonly gatherings: GatheringsService,
  ) {}

  @Get()
  @ApiOkResponse({ type: GroupSummaryDto, isArray: true })
  list(@CurrentAuth() auth: AuthContext): Promise<GroupSummaryDto[]> {
    return this.groups.list(auth.userId);
  }

  @Post()
  @HttpCode(200)
  @Requires('admin')
  @ApiOkResponse({ type: GroupDto })
  create(
    @CurrentAuth() auth: AuthContext,
    @Body() body: CreateGroupDto,
  ): Promise<GroupDto> {
    return this.groups.create(auth.userId, body);
  }

  @Get(':id')
  @ApiOkResponse({ type: GroupDto })
  get(
    @CurrentAuth() auth: AuthContext,
    @Param('id', id) groupId: string,
  ): Promise<GroupDto> {
    return this.groups.get(auth.userId, groupId);
  }

  @Patch(':id')
  @ApiOkResponse({ type: GroupDto })
  update(
    @CurrentAuth() auth: AuthContext,
    @Param('id', id) groupId: string,
    @Body() body: UpdateGroupDto,
  ): Promise<GroupDto> {
    return this.groups.update(auth.userId, groupId, body);
  }

  @Post(':id/admin')
  @HttpCode(200)
  @ApiOkResponse({ type: GroupDto })
  setAdmin(
    @CurrentAuth() auth: AuthContext,
    @Param('id', id) groupId: string,
    @Body() body: SetGroupAdminDto,
  ): Promise<GroupDto> {
    return this.groups.setAdmin(auth.userId, groupId, body.userId);
  }

  @Post(':id/members')
  @HttpCode(200)
  @ApiOkResponse({ type: GroupDto })
  addMember(
    @CurrentAuth() auth: AuthContext,
    @Param('id', id) groupId: string,
    @Body() body: AddMemberDto,
  ): Promise<GroupDto> {
    return this.groups.addMember(auth.userId, groupId, body);
  }

  @Patch(':id/members/:userId')
  @ApiOkResponse({ type: GroupDto })
  setRole(
    @CurrentAuth() auth: AuthContext,
    @Param('id', id) groupId: string,
    @Param('userId', id) userId: string,
    @Body() body: SetMemberRoleDto,
  ): Promise<GroupDto> {
    return this.groups.setRole(auth.userId, groupId, userId, body.role);
  }

  @Delete(':id/members/:userId')
  @ApiOkResponse({ type: GroupDto })
  removeMember(
    @CurrentAuth() auth: AuthContext,
    @Param('id', id) groupId: string,
    @Param('userId', id) userId: string,
  ): Promise<GroupDto> {
    return this.groups.removeMember(auth.userId, groupId, userId);
  }

  @Post(':id/activity-types')
  @HttpCode(200)
  @ApiOkResponse({ type: GatheringTypeDto })
  createActivityType(
    @CurrentAuth() auth: AuthContext,
    @Param('id', id) groupId: string,
    @Body() body: CreateGroupActivityTypeDto,
  ): Promise<GatheringTypeDto> {
    return this.groups.createActivityType(auth.userId, groupId, body);
  }

  @Post(':id/series')
  @HttpCode(200)
  @ApiOkResponse({ type: SeriesDto })
  createSeries(
    @CurrentAuth() auth: AuthContext,
    @Param('id', id) groupId: string,
    @Body() body: CreateSeriesDto,
  ): Promise<SeriesDto> {
    return this.gatherings.createSeries(auth.userId, groupId, body);
  }

  @Get(':id/gatherings')
  @ApiOkResponse({ type: GatheringPageDto })
  gatheringsOf(
    @CurrentAuth() auth: AuthContext,
    @Param('id', id) groupId: string,
    @Query() query: GatheringsQuery,
  ): Promise<GatheringPageDto> {
    return this.gatherings.list(auth.userId, groupId, query);
  }

  @Post(':id/gatherings')
  @HttpCode(200)
  @ApiOkResponse({ type: GatheringDto })
  createGathering(
    @CurrentAuth() auth: AuthContext,
    @Param('id', id) groupId: string,
    @Body() body: CreateGatheringDto,
  ): Promise<GatheringDto> {
    return this.gatherings.createOneOff(auth.userId, groupId, body);
  }
}
