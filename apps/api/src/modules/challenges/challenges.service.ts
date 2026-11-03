import { Injectable } from '@nestjs/common';
import { PrismaService, type Prisma } from '@tarbya/db';
import { forbidden } from '../../common/access';
import { AppException } from '../../common/app-exception';
import { impersonation } from '../../common/request-context';
import { MentoringAccess } from '../mentorships/mentoring-access.service';
import { RolesService } from '../users/roles.service';
import type {
  ChallengeDto,
  CreateChallengeDto,
  UpdateChallengeDto,
} from './challenges.dto';

const ref = { select: { id: true, name: true } } as const;

export const challengeSelect = {
  id: true,
  menteeId: true,
  title: true,
  interactionId: true,
  createdAt: true,
  resolvedAt: true,
  createdBy: ref,
  impersonator: ref,
  resolvedBy: ref,
  comments: {
    select: {
      id: true,
      body: true,
      interactionId: true,
      createdAt: true,
      author: ref,
      impersonator: ref,
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.ChallengeSelect;

export function toChallengeDto(
  c: Prisma.ChallengeGetPayload<{ select: typeof challengeSelect }>,
): ChallengeDto {
  return {
    ...c,
    createdAt: c.createdAt.toISOString(),
    resolvedAt: c.resolvedAt?.toISOString() ?? null,
    comments: c.comments.map((x) => ({
      ...x,
      createdAt: x.createdAt.toISOString(),
    })),
  };
}

const notFound = () =>
  new AppException(404, { code: 'NOT_FOUND', title: 'Challenge not found' });

/**
 * A mentee's challenges (BR-CHL-1…3): raised by their mentor or an admin,
 * discussed by them and the mentee, and resolved when they're behind them.
 */
@Injectable()
export class ChallengesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: MentoringAccess,
    private readonly roles: RolesService,
  ) {}

  /** Open ones first, newest first; then resolved ones, latest resolved first. */
  async list(viewerId: string, menteeId: string): Promise<ChallengeDto[]> {
    await this.access.assertCanView(viewerId, menteeId);
    const rows = await this.prisma.challenge.findMany({
      where: { menteeId },
      select: challengeSelect,
      orderBy: [
        { resolvedAt: { sort: 'desc', nulls: 'first' } },
        { createdAt: 'desc' },
      ],
    });
    return rows.map(toChallengeDto);
  }

  async create(
    actorId: string,
    dto: CreateChallengeDto,
  ): Promise<ChallengeDto> {
    await this.assertCanManage(actorId, dto.menteeId);
    const row = await this.prisma.challenge.create({
      data: {
        menteeId: dto.menteeId,
        createdById: actorId,
        title: dto.title,
        ...impersonation(),
      },
      select: challengeSelect,
    });
    return toChallengeDto(row);
  }

  /** Rename, resolve (resolved: true) or reopen (resolved: false). */
  async update(
    actorId: string,
    id: string,
    dto: UpdateChallengeDto,
  ): Promise<ChallengeDto> {
    const row = await this.prisma.challenge.findUnique({ where: { id } });
    if (!row) throw notFound();
    await this.assertCanManage(actorId, row.menteeId);
    const resolving = dto.resolved === true && !row.resolvedAt;
    const updated = await this.prisma.challenge.update({
      where: { id },
      data: {
        title: dto.title,
        ...(resolving && { resolvedAt: new Date(), resolvedById: actorId }),
        ...(dto.resolved === false && { resolvedAt: null, resolvedById: null }),
      },
      select: challengeSelect,
    });
    return toChallengeDto(updated);
  }

  /** The mentee, their mentor and admins discuss a challenge. */
  async comment(
    actorId: string,
    id: string,
    body: string,
  ): Promise<ChallengeDto> {
    const row = await this.prisma.challenge.findUnique({ where: { id } });
    if (!row) throw notFound();
    await this.access.assertCanView(actorId, row.menteeId);
    await this.prisma.challengeComment.create({
      data: { challengeId: id, authorId: actorId, body, ...impersonation() },
    });
    return toChallengeDto(
      await this.prisma.challenge.findUniqueOrThrow({
        where: { id },
        select: challengeSelect,
      }),
    );
  }

  private async assertCanManage(viewerId: string, menteeId: string) {
    const ok =
      !!(await this.access.currentMentorship(viewerId, menteeId)) ||
      (await this.roles.isAdmin(viewerId));
    if (!ok) throw forbidden();
  }
}
