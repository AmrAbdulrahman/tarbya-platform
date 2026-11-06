import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { PrismaService, type Prisma } from '@tarbya/db';
import { normalizeSearch } from '@tarbya/shared';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentAuth, type AuthContext } from '../../common/auth-context';
import { AvatarsService } from '../files/avatars.service';
import { MentoringAccess } from '../mentorships/mentoring-access.service';
import { RolesService } from './roles.service';
import { PersonRefDto } from './users.dto';
import { personSearch } from './users.service';

export class PersonDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() isMyMentee!: boolean;
}

/** A header search result: someone whose profile the viewer may open. */
export class PersonHitDto extends PersonRefDto {
  @ApiProperty({ type: String, nullable: true }) phone!: string | null;
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
        nameSearch: { contains: normalizeSearch(query.q) },
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

/** The header search (design/screens/Main.dc.html). */
@ApiTags('people')
@Controller('search')
export class SearchController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roles: RolesService,
  ) {}

  /**
   * The header search (design/screens/Main.dc.html): members whose profile the
   * viewer may open, by name or phone. Admins find everyone; mentors find their
   * current mentees. (Only moderators sit in the management line, so a
   * manager is already an admin.)
   */
  @Get('people')
  @ApiOkResponse({ type: PersonHitDto, isArray: true })
  async find(
    @CurrentAuth() auth: AuthContext,
    @Query() query: PeopleQuery,
  ): Promise<PersonHitDto[]> {
    if (!query.q) return [];
    const mine = {
      mentoredBy: { some: { mentorId: auth.userId, endedAt: null } },
    } satisfies Prisma.UserWhereInput;
    const admin = await this.roles.isAdmin(auth.userId);
    const rows = await this.prisma.user.findMany({
      where: {
        id: { not: auth.userId },
        AND: [{ OR: personSearch(query.q) }, ...(admin ? [] : [mine])],
      },
      select: {
        id: true,
        name: true,
        phone: true,
        avatarFileId: true,
        mentoredBy: {
          where: { mentorId: auth.userId, endedAt: null },
          select: { id: true },
        },
      },
      // Active people first, then by name.
      orderBy: [
        { deactivatedAt: { sort: 'desc', nulls: 'first' } },
        { name: 'asc' },
      ],
      take: 8,
    });
    return rows.map((u) => ({
      id: u.id,
      name: u.name,
      phone: u.phone,
      avatarUrl: AvatarsService.url(u.id, u.avatarFileId),
      isMyMentee: u.mentoredBy.length > 0,
    }));
  }
}
