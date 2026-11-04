import { Injectable } from '@nestjs/common';
import { PrismaService } from '@tarbya/db';
import { takesTarget } from '@tarbya/shared';
import { forbidden } from '../../common/access';
import { AppException } from '../../common/app-exception';
import { impersonation } from '../../common/request-context';
import { RolesService } from '../users/roles.service';
import { describeTemplates, templateSelect, visibleTo } from './template-view';
import type { TrackableDetailDto } from './trackables.dto';
import { TrackablesService } from './trackables.service';
import type {
  AssignTemplateDto,
  TrackableTemplateDto,
  UpdateTemplateDto,
} from './templates.dto';

const notFound = () =>
  new AppException(404, { code: 'NOT_FOUND', title: 'Template not found' });

/**
 * The trackable library (BR-TRK-7…9): templates mentors save from their
 * mentees' trackables, keep to themselves or share with every mentor, and
 * assign to other mentees. Linked trackables follow the template's edits.
 */
@Injectable()
export class TrackableTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roles: RolesService,
    private readonly trackables: TrackablesService,
  ) {}

  /** Mine first, then shared ones, each by name. */
  async list(
    viewerId: string,
    menteeId?: string,
  ): Promise<TrackableTemplateDto[]> {
    const viewer = await this.assertCanUse(viewerId);
    if (menteeId) await this.trackables.assertCanManage(viewerId, menteeId);
    const rows = await this.prisma.trackableTemplate.findMany({
      where: visibleTo(viewerId),
      select: templateSelect,
    });
    rows.sort(
      (a, b) =>
        Number(a.authorId !== viewerId) - Number(b.authorId !== viewerId) ||
        a.name.localeCompare(b.name),
    );
    return describeTemplates(this.prisma, rows, viewer, menteeId);
  }

  /** "Save as template": the trackable joins the library and follows it from now on. */
  async saveFromTrackable(
    actorId: string,
    trackableId: string,
    isPublic: boolean,
  ): Promise<TrackableDetailDto> {
    const row = await this.prisma.trackable.findUnique({
      where: { id: trackableId },
    });
    if (!row) throw notFound();
    await this.trackables.assertCanManage(actorId, row.menteeId);
    if (row.templateId) {
      throw new AppException(409, {
        code: 'TRACKABLE_FROM_TEMPLATE',
        title: 'This trackable already follows a template',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      const template = await tx.trackableTemplate.create({
        data: {
          authorId: actorId,
          ...impersonation(),
          name: row.name,
          goal: row.goal,
          type: row.type,
          cycle: row.cycle,
          higherIsBetter: row.higherIsBetter,
          target: takesTarget(row.type) ? row.target : null,
          isPublic,
        },
      });
      await tx.trackable.update({
        where: { id: trackableId },
        data: { templateId: template.id },
      });
    });
    return this.trackables.get(actorId, trackableId);
  }

  /** The author or an admin; name, goal, type, cycle and direction reach every linked trackable. */
  async update(
    actorId: string,
    id: string,
    dto: UpdateTemplateDto,
  ): Promise<TrackableTemplateDto> {
    const viewer = await this.assertCanEdit(actorId, id);
    const row = await this.prisma.trackableTemplate.findUniqueOrThrow({
      where: { id },
    });
    const reshaping =
      (dto.type && dto.type !== row.type) ||
      (dto.cycle && dto.cycle !== row.cycle);
    if (
      reshaping &&
      (await this.prisma.trackableEntry.count({
        where: { trackable: { templateId: id } },
        take: 1,
      }))
    ) {
      throw new AppException(409, {
        code: 'TRACKABLE_HAS_ENTRIES',
        title: 'Type and cycle are fixed once something is logged',
      });
    }
    const shared = {
      name: dto.name,
      goal: dto.goal,
      type: dto.type,
      cycle: dto.cycle,
      higherIsBetter: dto.higherIsBetter,
    };
    const noTarget = !takesTarget(dto.type ?? row.type);
    await this.prisma.$transaction([
      this.prisma.trackableTemplate.update({
        where: { id },
        data: {
          ...shared,
          target: noTarget ? null : dto.target,
          isPublic: dto.isPublic,
        },
      }),
      this.prisma.trackable.updateMany({
        where: { templateId: id },
        data: {
          ...shared,
          ...(noTarget && { target: null }),
          // A weekday means nothing outside a weekly cycle.
          ...(dto.cycle && dto.cycle !== 'WEEKLY' && { weekday: null }),
        },
      }),
    ]);
    const updated = await this.prisma.trackableTemplate.findUniqueOrThrow({
      where: { id },
      select: templateSelect,
    });
    return (await describeTemplates(this.prisma, [updated], viewer))[0];
  }

  /** Takes it out of the library; linked trackables keep their values and become independent. */
  async remove(actorId: string, id: string): Promise<void> {
    await this.assertCanEdit(actorId, id);
    await this.prisma.$transaction([
      this.prisma.trackable.updateMany({
        where: { templateId: id },
        data: { templateId: null },
      }),
      this.prisma.trackableTemplate.update({
        where: { id },
        data: { removedAt: new Date() },
      }),
    ]);
  }

  /** Gives a mentee their own trackable that follows the template. */
  async assign(
    actorId: string,
    id: string,
    dto: AssignTemplateDto,
  ): Promise<TrackableDetailDto> {
    const template = await this.prisma.trackableTemplate.findFirst({
      where: { id, ...visibleTo(actorId) },
    });
    if (!template) throw notFound();
    await this.trackables.assertCanManage(actorId, dto.menteeId);
    const taken = await this.prisma.trackable.count({
      where: { templateId: id, menteeId: dto.menteeId, archivedAt: null },
    });
    if (taken) {
      throw new AppException(409, {
        code: 'TEMPLATE_ALREADY_ASSIGNED',
        title: 'This mentee already follows that template',
      });
    }
    return this.trackables.create(
      actorId,
      {
        menteeId: dto.menteeId,
        name: template.name,
        goal: template.goal,
        type: template.type,
        cycle: template.cycle,
        higherIsBetter: template.higherIsBetter,
        target: !takesTarget(template.type)
          ? null
          : dto.target === undefined
            ? template.target
            : dto.target,
        startsOn: dto.startsOn,
        weekday: dto.weekday,
      },
      id,
    );
  }

  /** Mentors and admins use the library. */
  private async assertCanUse(viewerId: string) {
    const [isAdmin, mentoring] = await Promise.all([
      this.roles.isAdmin(viewerId),
      this.prisma.mentorship.count({
        where: { mentorId: viewerId, endedAt: null },
        take: 1,
      }),
    ]);
    if (!isAdmin && !mentoring) throw forbidden();
    return { id: viewerId, isAdmin };
  }

  private async assertCanEdit(viewerId: string, id: string) {
    const template = await this.prisma.trackableTemplate.findFirst({
      where: { id, ...visibleTo(viewerId) },
      select: { authorId: true },
    });
    if (!template) throw notFound();
    const isAdmin = await this.roles.isAdmin(viewerId);
    if (!isAdmin && template.authorId !== viewerId) throw forbidden();
    return { id: viewerId, isAdmin };
  }
}
