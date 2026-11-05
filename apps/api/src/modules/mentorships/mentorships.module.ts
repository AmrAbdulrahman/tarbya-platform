import { Global, Module } from '@nestjs/common';
import { ContactScanService } from './contact-scan.service';
import { ContactService } from './contact.service';
import { MentoringAccess } from './mentoring-access.service';
import { MentorshipsController } from './mentorships.controller';
import { MentorshipsService } from './mentorships.service';

@Global()
@Module({
  controllers: [MentorshipsController],
  providers: [
    MentorshipsService,
    ContactService,
    ContactScanService,
    MentoringAccess,
  ],
  exports: [
    MentoringAccess,
    ContactService,
    ContactScanService,
    MentorshipsService,
  ],
})
export class MentorshipsModule {}
