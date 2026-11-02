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
import { Requires } from '../../common/access';
import { CurrentAuth, type AuthContext } from '../../common/auth-context';
import {
  CreateUserDto,
  ListUsersQuery,
  SetManagerDto,
  SetModeratorDto,
  UpdateUserDto,
  UserDto,
  UserPageDto,
} from './users.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
@Requires('admin')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOkResponse({ type: UserPageDto })
  list(@Query() query: ListUsersQuery): Promise<UserPageDto> {
    return this.users.list(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: UserDto })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<UserDto> {
    return this.users.get(id);
  }

  @Post()
  @ApiOkResponse({ type: UserDto })
  @ApiConflictResponse({
    description: 'USER_EMAIL_TAKEN, USER_PHONE_TAKEN, MANAGER_INACTIVE',
  })
  @HttpCode(200)
  create(
    @CurrentAuth() auth: AuthContext,
    @Body() body: CreateUserDto,
  ): Promise<UserDto> {
    return this.users.create(auth.userId, body);
  }

  @Patch(':id')
  @ApiOkResponse({ type: UserDto })
  @ApiConflictResponse({
    description: 'USER_EMAIL_TAKEN, USER_PHONE_TAKEN, SUPER_ADMIN_LOCKED',
  })
  update(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateUserDto,
  ): Promise<UserDto> {
    return this.users.update(auth.userId, id, body);
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  @ApiOkResponse({ type: UserDto })
  @ApiConflictResponse({ description: 'SUPER_ADMIN_LOCKED, SELF_ACTION' })
  deactivate(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserDto> {
    return this.users.setActive(auth.userId, id, false);
  }

  @Post(':id/reactivate')
  @HttpCode(200)
  @ApiOkResponse({ type: UserDto })
  reactivate(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserDto> {
    return this.users.setActive(auth.userId, id, true);
  }

  @Put(':id/manager')
  @ApiOkResponse({ type: UserDto })
  @ApiConflictResponse({ description: 'MANAGER_CYCLE, MANAGER_INACTIVE' })
  setManager(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SetManagerDto,
  ): Promise<UserDto> {
    return this.users.setManager(auth.userId, id, body.managerId ?? null);
  }

  @Put(':id/moderator')
  @Requires('superAdmin')
  @ApiOkResponse({ type: UserDto })
  @ApiConflictResponse({ description: 'SUPER_ADMIN_LOCKED' })
  setModerator(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SetModeratorDto,
  ): Promise<UserDto> {
    return this.users.setModerator(auth.userId, id, body.isModerator);
  }
}
