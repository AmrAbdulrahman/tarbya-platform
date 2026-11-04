import { Module } from '@nestjs/common';
import { TrackablesModule } from '../trackables/trackables.module';
import {
  InteractionsController,
  TasksController,
} from './interactions.controller';
import { InteractionsService } from './interactions.service';
import { TasksService } from './tasks.service';

@Module({
  imports: [TrackablesModule],
  controllers: [InteractionsController, TasksController],
  providers: [InteractionsService, TasksService],
})
export class InteractionsModule {}
