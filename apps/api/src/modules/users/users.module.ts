import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PeopleController, SearchController } from './people.controller';
import { RolesService } from './roles.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [UsersController, PeopleController, SearchController],
  providers: [RolesService, UsersService],
  exports: [RolesService],
})
export class UsersModule {}
