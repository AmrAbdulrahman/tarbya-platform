import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentAuth, type AuthContext } from '../../common/auth-context';
import { ProfileDto } from './profiles.dto';
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
}
