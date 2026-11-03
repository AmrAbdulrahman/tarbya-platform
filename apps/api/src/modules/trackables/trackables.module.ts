import { Module } from '@nestjs/common';
import { TrackablesController } from './trackables.controller';
import { TrackablesService } from './trackables.service';

@Module({
  controllers: [TrackablesController],
  providers: [TrackablesService],
  exports: [TrackablesService],
})
export class TrackablesModule {}
