import { Global, Module } from '@nestjs/common';
import { AvatarsService } from './avatars.service';
import { FilesController } from './files.controller';
import { StorageService } from './storage.service';

@Global()
@Module({
  controllers: [FilesController],
  providers: [StorageService, AvatarsService],
  exports: [AvatarsService, StorageService],
})
export class FilesModule {}
