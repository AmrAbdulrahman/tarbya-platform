import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AppException } from '../../common/app-exception';
import { CurrentAuth, type AuthContext } from '../../common/auth-context';
import { AVATAR_MAX_BYTES, AvatarsService } from '../files/avatars.service';
import {
  ChangePasswordDto,
  ConfirmContactChangeDto,
  MyProfileDto,
  RequestContactChangeDto,
  UpdateMyProfileDto,
} from './me.dto';
import { MeService } from './me.service';

@ApiTags('me')
@Controller('me')
export class MeController {
  constructor(
    private readonly me: MeService,
    private readonly avatars: AvatarsService,
  ) {}

  @Get('profile')
  @ApiOkResponse({ type: MyProfileDto })
  profile(@CurrentAuth() auth: AuthContext): Promise<MyProfileDto> {
    return this.me.profile(auth.userId);
  }

  @Patch('profile')
  @ApiOkResponse({ type: MyProfileDto })
  update(
    @CurrentAuth() auth: AuthContext,
    @Body() body: UpdateMyProfileDto,
  ): Promise<MyProfileDto> {
    return this.me.update(auth.userId, body);
  }

  /** US-2.1: JPEG, PNG or WebP up to 5 MB; resized on the server. */
  @Post('avatar')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: AVATAR_MAX_BYTES, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiOkResponse({ type: MyProfileDto })
  async uploadAvatar(
    @CurrentAuth() auth: AuthContext,
    @UploadedFile() file: { buffer: Buffer } | undefined,
  ): Promise<MyProfileDto> {
    if (!file)
      throw new AppException(400, {
        code: 'FILE_TYPE',
        title: 'Attach an image as "file"',
      });
    await this.avatars.set(auth.userId, file.buffer);
    return this.me.profile(auth.userId);
  }

  @Delete('avatar')
  @ApiOkResponse({ type: MyProfileDto })
  async removeAvatar(@CurrentAuth() auth: AuthContext): Promise<MyProfileDto> {
    await this.avatars.remove(auth.userId);
    return this.me.profile(auth.userId);
  }

  /** US-2.2 */
  @Post('contact')
  @HttpCode(204)
  @ApiNoContentResponse()
  requestContactChange(
    @CurrentAuth() auth: AuthContext,
    @Body() body: RequestContactChangeDto,
  ): Promise<void> {
    return this.me.requestContactChange(auth.userId, body.kind, body.value);
  }

  @Post('contact/confirm')
  @HttpCode(200)
  @ApiOkResponse({ type: MyProfileDto })
  confirmContactChange(
    @CurrentAuth() auth: AuthContext,
    @Body() body: ConfirmContactChangeDto,
  ): Promise<MyProfileDto> {
    return this.me.confirmContactChange(auth.userId, body.kind, body.code);
  }

  /** US-2.3 */
  @Put('password')
  @HttpCode(204)
  @ApiNoContentResponse()
  changePassword(
    @CurrentAuth() auth: AuthContext,
    @Body() body: ChangePasswordDto,
  ): Promise<void> {
    return this.me.changePassword(
      auth.userId,
      auth.sessionId,
      body.currentPassword,
      body.newPassword,
    );
  }
}
