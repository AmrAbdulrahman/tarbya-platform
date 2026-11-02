import { Module } from '@nestjs/common';
import {
  InteractionsController,
  TasksController,
} from './interactions.controller';
import { InteractionsService } from './interactions.service';
import { TasksService } from './tasks.service';

@Module({
  controllers: [InteractionsController, TasksController],
  providers: [InteractionsService, TasksService],
})
export class InteractionsModule {}
