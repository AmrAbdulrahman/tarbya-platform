import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '@tarbya/db';
import { Requires } from '../../common/access';
import type { Env } from '../../config/env';
import { ManagementNodeDto } from './hierarchy.dto';

@ApiTags('hierarchy')
@Controller('hierarchy')
@Requires('admin')
export class HierarchyController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Everyone in the management line (BR-MGR-1): active moderators, the super
   * admin, and anyone with a manager or reports. The admin screen draws the tree.
   */
  @Get('management')
  @ApiOkResponse({ type: ManagementNodeDto, isArray: true })
  management(): Promise<ManagementNodeDto[]> {
    return this.prisma.user.findMany({
      where: {
        deactivatedAt: null,
        OR: [
          { isModerator: true },
          { managerId: { not: null } },
          { reports: { some: { deactivatedAt: null } } },
          {
            email: {
              equals: this.config.get('SUPER_ADMIN_EMAIL', { infer: true }),
              mode: 'insensitive',
            },
          },
        ],
      },
      select: { id: true, name: true, managerId: true },
      orderBy: { name: 'asc' },
    });
  }
}
