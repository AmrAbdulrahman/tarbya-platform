import { Global, Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService, ChangeLogService } from './audit.service';

@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService, ChangeLogService],
  exports: [AuditService],
})
export class AuditModule {}
