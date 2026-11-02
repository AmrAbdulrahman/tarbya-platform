import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Requires } from '../../common/access';
import { CurrentAuth, type AuthContext } from '../../common/auth-context';
import {
  fromSettings,
  SettingsDto,
  toSettings,
  UpdateSettingsDto,
} from './settings.dto';
import { SettingsService } from './settings.service';

/** US-3.6 */
@ApiTags('settings')
@Controller('settings')
@Requires('admin')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @ApiOkResponse({ type: SettingsDto })
  async get(): Promise<SettingsDto> {
    return fromSettings(await this.settings.all());
  }

  @Patch()
  @ApiOkResponse({ type: SettingsDto })
  async update(
    @CurrentAuth() auth: AuthContext,
    @Body() body: UpdateSettingsDto,
  ): Promise<SettingsDto> {
    return fromSettings(
      await this.settings.update(auth.userId, toSettings(body)),
    );
  }
}
