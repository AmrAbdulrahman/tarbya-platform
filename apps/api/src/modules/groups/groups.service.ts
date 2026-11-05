import { Injectable } from '@nestjs/common';
import { PrismaService, type Prisma } from '@tarbya/db';
import { forbidden } from '../../common/access';
import { AppException } from '../../common/app-exception';
import { AuditService } from '../audit/audit.service';
import { AvatarsService } from '../files/avatars.service';
import { HierarchyService } from '../hierarchy/hierarchy.service';
import { RolesService } from '../users/roles.service';
import {
  gatheringSelect,
  gatheringTypeSelect,
  seriesSelect,
  toGatheringSummary,
  toSeriesDto,
} from './gatherings.service';
import {
  canManageGroup,
  canManageRoles,
  GroupAccess,
  groupNotFound,
} from './group-access.service';
import type {
  AddMemberDto,
  CreateGroupActivityTypeDto,
  CreateGroupDto,
  GatheringTypeDto,
  GroupDto,
  GroupRole,
  GroupSummaryDto,
  UpdateGroupDto,
} from './groups.dto';

const person = { select: { id: true, name: true, avatarFileId: true } };
const toPerson = (u: {
  id: string;
  name: string;
  avatarFileId: string | null;
}) => ({
  id: u.id,
  name: u.name,
  avatarUrl: AvatarsService.url(u.id, u.avatarFileId),
});

const summarySelect = {
  id: true,
  name: true,
  description: true,
  memberships: {
    select: { userId: true, role: true, user: person },
    orderBy: { user: { name: 'asc' } },
  },
} satisfies Prisma.GroupSelect;

type SummaryRow = Prisma.GroupGetPayload<{ select: typeof summarySelect }>;

const userInactive = () =>
  new AppException(400, {
    code: 'USER_INACTIVE',
    title: 'This user is deactivated',
  });

/**
 * Groups (BR-GRP-1…4, BR-GRP-10): moderators create them with one admin; the
 * admin and group moderators run them; the admin's manager chain looks on.
 */
@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: GroupAccess,
    private readonly roles: RolesService,
    private readonly hierarchy: HierarchyService,
    private readonly audit: AuditService,
  ) {}

  /** Groups the viewer belongs to or oversees; admins see them all. Filtered in SQL. */
  async list(viewerId: string): Promise<GroupSummaryDto[]> {
    const admin = await this.roles.isAdmin(viewerId);
    const below = admin
      ? []
      : await this.hierarchy.groupsBelow(this.prisma, viewerId);
    const rows = await this.prisma.group.findMany({
      where: {
        archivedAt: null,
        ...(!admin && {
          OR: [
            { memberships: { some: { userId: viewerId } } },
            { id: { in: below } },
          ],
        }),
      },
      select: summarySelect,
      orderBy: { name: 'asc' },
    });
    const next = await this.prisma.gathering.findMany({
      where: {
        groupId: { in: rows.map((r) => r.id) },
        cancelledAt: null,
        startsAt: { gt: new Date() },
      },
      select: gatheringSelect,
      orderBy: { startsAt: 'asc' },
      distinct: ['groupId'],
    });
    const nextOf = new Map(next.map((g) => [g.groupId, g]));
    return rows.map((r) => {
      const g = nextOf.get(r.id);
      return {
        ...this.summary(r, viewerId),
        nextGathering: g ? toGatheringSummary(g, viewerId) : null,
      };
    });
  }

  async get(viewerId: string, id: string): Promise<GroupDto> {
    const view = await this.access.assertView(viewerId, id);
    const today = new Date(new Date().toISOString().slice(0, 10));
    const [row, series, types, next] = await Promise.all([
      this.prisma.group.findUniqueOrThrow({
        where: { id },
        select: summarySelect,
      }),
      this.prisma.gatheringSeries.findMany({
        where: {
          groupId: id,
          OR: [{ endsOn: null }, { endsOn: { gte: today } }],
        },
        select: seriesSelect,
        orderBy: [{ weekday: 'asc' }, { time: 'asc' }],
      }),
      this.prisma.activityType.findMany({
        where: {
          active: true,
          OR: [
            { scope: 'GROUP_RECURRING', groupId: null },
            {
              scope: 'GROUP_ONE_OFF',
              OR: [{ groupId: null }, { groupId: id }],
            },
          ],
        },
        select: gatheringTypeSelect,
        orderBy: { nameEn: 'asc' },
      }),
      this.prisma.gathering.findFirst({
        where: { groupId: id, cancelledAt: null, startsAt: { gt: new Date() } },
        select: gatheringSelect,
        orderBy: { startsAt: 'asc' },
      }),
    ]);
    return {
      ...this.summary(row, viewerId),
      nextGathering: next ? toGatheringSummary(next, viewerId) : null,
      members: row.memberships.map((m) => ({
        ...toPerson(m.user),
        role: m.role,
      })),
      canManage: canManageGroup(view),
      canManageRoles: canManageRoles(view),
      series: series.map(toSeriesDto),
      activityTypes: types,
    };
  }

  /** US-6.1: a moderator creates a group and names its one admin (BR-GRP-1). */
  async create(actorId: string, dto: CreateGroupDto): Promise<GroupDto> {
    await this.assertActive(dto.adminId);
    const group = await this.prisma.$transaction(async (tx) => {
      const group = await tx.group.create({
        data: {
          name: dto.name,
          description: dto.description ?? null,
          createdById: actorId,
          memberships: { create: { userId: dto.adminId, role: 'ADMIN' } },
        },
      });
      await this.audit.record(
        {
          actorId,
          action: 'group.create',
          entity: 'Group',
          entityId: group.id,
          diff: { name: [null, dto.name], adminId: [null, dto.adminId] },
        },
        tx,
      );
      return group;
    });
    return this.get(actorId, group.id);
  }

  async update(
    actorId: string,
    id: string,
    dto: UpdateGroupDto,
  ): Promise<GroupDto> {
    await this.access.assertManageRoles(actorId, id);
    if (dto.archived !== undefined && !(await this.roles.isAdmin(actorId)))
      throw forbidden();
    await this.prisma.$transaction(async (tx) => {
      const before = await tx.group.findUniqueOrThrow({ where: { id } });
      await tx.group.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          ...(dto.archived !== undefined && {
            archivedAt: dto.archived ? new Date() : null,
          }),
        },
      });
      await this.audit.record(
        {
          actorId,
          action: 'group.update',
          entity: 'Group',
          entityId: id,
          diff: {
            ...(dto.name !== undefined && { name: [before.name, dto.name] }),
            ...(dto.archived !== undefined && {
              archived: [!!before.archivedAt, dto.archived],
            }),
          },
        },
        tx,
      );
    });
    return this.get(actorId, id);
  }

  /**
   * Hand over the admin role (BR-GRP-2). The old admin stays on as a group
   * moderator, so nobody drops out of the group by accident.
   */
  async setAdmin(
    actorId: string,
    id: string,
    userId: string,
  ): Promise<GroupDto> {
    await this.access.assertManageRoles(actorId, id);
    await this.assertActive(userId);
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.groupMembership.findFirst({
        where: { groupId: id, role: 'ADMIN' },
      });
      if (current?.userId === userId) return;
      if (current) {
        await tx.groupMembership.update({
          where: { id: current.id },
          data: { role: 'MODERATOR' },
        });
      }
      await tx.groupMembership.upsert({
        where: { groupId_userId: { groupId: id, userId } },
        create: { groupId: id, userId, role: 'ADMIN' },
        update: { role: 'ADMIN' },
      });
      await this.audit.record(
        {
          actorId,
          action: 'group.admin.set',
          entity: 'Group',
          entityId: id,
          diff: { adminId: [current?.userId ?? null, userId] },
        },
        tx,
      );
    });
    return this.get(actorId, id);
  }

  /** US-6.2: members need an active mentor (BR-GRP-3); moderators are appointed by the admin. */
  async addMember(
    actorId: string,
    id: string,
    dto: AddMemberDto,
  ): Promise<GroupDto> {
    const role = dto.role ?? 'MEMBER';
    if (role === 'MODERATOR') await this.access.assertManageRoles(actorId, id);
    else await this.access.assertManage(actorId, id);
    await this.assertActive(dto.userId);
    if (role === 'MEMBER') await this.assertHasMentor(dto.userId);
    const existing = await this.prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId: id, userId: dto.userId } },
    });
    if (existing) {
      throw new AppException(409, {
        code: 'GROUP_ALREADY_MEMBER',
        title: 'Already in this group',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.groupMembership.create({
        data: { groupId: id, userId: dto.userId, role },
      });
      await this.audit.record(
        {
          actorId,
          action: 'group.member.add',
          entity: 'Group',
          entityId: id,
          diff: { [dto.userId]: [null, role] },
        },
        tx,
      );
    });
    return this.get(actorId, id);
  }

  async setRole(
    actorId: string,
    id: string,
    userId: string,
    role: Exclude<GroupRole, 'ADMIN'>,
  ): Promise<GroupDto> {
    await this.access.assertManageRoles(actorId, id);
    const membership = await this.membership(id, userId);
    if (membership.role === 'ADMIN') throw adminLocked();
    if (role === 'MEMBER') await this.assertHasMentor(userId);
    await this.prisma.$transaction(async (tx) => {
      await tx.groupMembership.update({
        where: { id: membership.id },
        data: { role },
      });
      await this.audit.record(
        {
          actorId,
          action: 'group.role.set',
          entity: 'Group',
          entityId: id,
          diff: { [userId]: [membership.role, role] },
        },
        tx,
      );
    });
    return this.get(actorId, id);
  }

  /** The admin can't be removed, only replaced; moderators only by those who appoint them. */
  async removeMember(
    actorId: string,
    id: string,
    userId: string,
  ): Promise<GroupDto> {
    const membership = await this.membership(id, userId);
    if (membership.role === 'ADMIN') throw adminLocked();
    if (membership.role === 'MODERATOR')
      await this.access.assertManageRoles(actorId, id);
    else await this.access.assertManage(actorId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.groupMembership.delete({ where: { id: membership.id } });
      await this.audit.record(
        {
          actorId,
          action: 'group.member.remove',
          entity: 'Group',
          entityId: id,
          diff: { [userId]: [membership.role, null] },
        },
        tx,
      );
    });
    return this.get(actorId, id);
  }

  /** The group's own one-time activity types (BR-GRP-6, design/screens/ActivityTypes.dc.html). */
  async createActivityType(
    actorId: string,
    id: string,
    dto: CreateGroupActivityTypeDto,
  ): Promise<GatheringTypeDto> {
    await this.access.assertManage(actorId, id);
    return this.prisma.activityType.create({
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        color: dto.color ?? 'PURPLE',
        scope: 'GROUP_ONE_OFF',
        groupId: id,
      },
      select: gatheringTypeSelect,
    });
  }

  private summary(
    row: SummaryRow,
    viewerId: string,
  ): Omit<GroupSummaryDto, 'nextGathering'> {
    const admin = row.memberships.find((m) => m.role === 'ADMIN');
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      admin: admin ? toPerson(admin.user) : null,
      moderators: row.memberships
        .filter((m) => m.role === 'MODERATOR')
        .map((m) => ({ id: m.user.id, name: m.user.name })),
      memberCount: row.memberships.length,
      myRole: row.memberships.find((m) => m.userId === viewerId)?.role ?? null,
    };
  }

  private async membership(groupId: string, userId: string) {
    const m = await this.prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!m) throw groupNotFound();
    return m;
  }

  private async assertActive(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { deactivatedAt: true },
    });
    if (!user)
      throw new AppException(404, {
        code: 'NOT_FOUND',
        title: 'User not found',
      });
    if (user.deactivatedAt) throw userInactive();
  }

  private async assertHasMentor(userId: string) {
    const mentored = await this.prisma.mentorship.count({
      where: { menteeId: userId, endedAt: null },
    });
    if (!mentored) {
      throw new AppException(400, {
        code: 'GROUP_MEMBER_NEEDS_MENTOR',
        title: 'Only mentees with an active mentor can join a group',
      });
    }
  }
}

const adminLocked = () =>
  new AppException(409, {
    code: 'GROUP_ADMIN_LOCKED',
    title: 'Hand the admin role to someone else first',
  });
