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
    const where = {
      deactivatedAt: null,
      id: { not: auth.userId },
      ...(query.q && {
        name: { contains: query.q, mode: 'insensitive' as const },
      }),
    };
    const mine = {
      mentoredBy: { some: { mentorId: auth.userId, endedAt: null } },
    };
    // Mentees first, then everyone else, so a mentee is never cut off by the limit.
    const [mentees, others] = await Promise.all([
      this.prisma.user.findMany({
        where: { ...where, ...mine },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        take: 10,
      }),
      this.prisma.user.findMany({
        where: { ...where, NOT: mine },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        take: 10,
      }),
    ]);
    return [
      ...mentees.map((u) => ({ ...u, isMyMentee: true })),
      ...others.map((u) => ({ ...u, isMyMentee: false })),
    ].slice(0, 10);
  }
}
