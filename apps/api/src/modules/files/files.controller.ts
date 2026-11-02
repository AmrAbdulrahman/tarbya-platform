import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  StreamableFile,
} from '@nestjs/common';
import { ApiOkResponse, ApiProduces, ApiTags } from '@nestjs/swagger';
import { AvatarsService } from './avatars.service';

@ApiTags('files')
@Controller('files')
export class FilesController {
  constructor(private readonly avatars: AvatarsService) {}

  /** Any signed-in member can see a profile picture. URLs carry the file id, so they cache for long. */
  @Get('avatars/:userId')
  @Header('Cache-Control', 'private, max-age=31536000, immutable')
  @ApiProduces('image/webp')
  @ApiOkResponse({ description: 'The picture' })
  async avatar(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<StreamableFile> {
    const { stream, mime } = await this.avatars.read(userId);
    return new StreamableFile(stream, {
      type: mime,
      disposition: 'inline',
    });
  }
}
