import { Module } from '@nestjs/common';
import { TrackablesController } from './trackables.controller';
import { TrackablesService } from './trackables.service';
import { TrackableTemplatesController } from './templates.controller';
import { TrackableTemplatesService } from './templates.service';

@Module({
  controllers: [TrackablesController, TrackableTemplatesController],
  providers: [TrackablesService, TrackableTemplatesService],
  exports: [TrackablesService],
})
export class TrackablesModule {}
