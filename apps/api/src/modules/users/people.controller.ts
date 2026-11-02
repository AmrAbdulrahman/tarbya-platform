import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { PrismaService } from '@tarbya/db';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentAuth, type AuthContext } from '../../common/auth-context';
import { MentoringAccess } from '../mentorships/mentoring-access.service';

export class PersonDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() isMyMentee!: boolean;
}

export class PeopleQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  q?: string;
}

/**
 * Typeahead for picking people outside admin screens (BR-USR-6), e.g. activity
 * participants (any active user, BR-FU-2). Names only; the caller's mentees first.
 */
@ApiTags('people')
@Controller('people')
export class PeopleController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: MentoringAccess,
  ) {}

  @Get()
  @ApiOkResponse({ type: PersonDto, isArray: true })
  async search(
    @CurrentAuth() auth: AuthContext,
    @Query() query: PeopleQuery,
  ): Promise<PersonDto[]> {
    await this.access.assertMentorOrAdmin(auth.userId);
    const rows = await this.prisma.user.findMany({
      where: {
        deactivatedAt: null,
        id: { not: auth.userId },
        ...(query.q && { name: { contains: query.q, mode: 'insensitive' } }),
      },
      select: {
        id: true,
        name: true,
        mentoredBy: {
          where: { mentorId: auth.userId, endedAt: null },
          select: { id: true },
        },
      },
      orderBy: { name: 'asc' },
      take: 50,
    });
    return rows
      .map((r) => ({
        id: r.id,
        name: r.name,
        isMyMentee: r.mentoredBy.length > 0,
      }))
      .sort((a, b) => Number(b.isMyMentee) - Number(a.isMyMentee))
      .slice(0, 10);
  }
}
