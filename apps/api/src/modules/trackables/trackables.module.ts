import { Module } from '@nestjs/common';
import { CycleScanService } from './cycle-scan.service';
import { TrackablesController } from './trackables.controller';
import { TrackablesService } from './trackables.service';
import { TrackableTemplatesController } from './templates.controller';
import { TrackableTemplatesService } from './templates.service';

@Module({
  controllers: [TrackablesController, TrackableTemplatesController],
  providers: [TrackablesService, TrackableTemplatesService, CycleScanService],
  exports: [TrackablesService],
})
export class TrackablesModule {}
