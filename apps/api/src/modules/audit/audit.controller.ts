import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Requires } from '../../common/access';
import { ChangePageDto, ChangesQuery } from './audit.dto';
import { ChangeLogService } from './audit.service';

@ApiTags('audit')
@Controller('audit')
export class AuditController {
  constructor(private readonly changes: ChangeLogService) {}

  /** A member's change log, newest first (BR-ADM-4, BR-ADM-5). */
  @Get()
  @Requires('admin')
  @ApiOkResponse({ type: ChangePageDto })
  list(@Query() query: ChangesQuery): Promise<ChangePageDto> {
    return this.changes.forUser(query.userId, query.before);
  }
}
