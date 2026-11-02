import { Global, Module } from '@nestjs/common';
import { ContactService } from './contact.service';
import { MentoringAccess } from './mentoring-access.service';
import { MentorshipsController } from './mentorships.controller';
import { MentorshipsService } from './mentorships.service';

@Global()
@Module({
  controllers: [MentorshipsController],
  providers: [MentorshipsService, ContactService, MentoringAccess],
  exports: [MentoringAccess, ContactService, MentorshipsService],
})
export class MentorshipsModule {}
