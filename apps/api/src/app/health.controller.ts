import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '@tarbya/db';

class HealthDto {
  @ApiProperty({ enum: ['ok'] })
  status!: 'ok';
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOkResponse({ type: HealthDto })
  async check(): Promise<HealthDto> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('Database unreachable');
    }
    return { status: 'ok' };
  }
}
