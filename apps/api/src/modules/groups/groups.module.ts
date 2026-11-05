import { Module } from '@nestjs/common';
import { GatheringsController } from './gatherings.controller';
import { GatheringsService } from './gatherings.service';
import { GroupAccess } from './group-access.service';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';

@Module({
  controllers: [GroupsController, GatheringsController],
  providers: [GroupsService, GatheringsService, GroupAccess],
  exports: [GatheringsService],
})
export class GroupsModule {}
