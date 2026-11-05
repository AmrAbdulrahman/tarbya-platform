import { Injectable } from '@nestjs/common';
import { PrismaService } from '@tarbya/db';
import { forbidden } from '../../common/access';
import { AppException } from '../../common/app-exception';
import { HierarchyService } from '../hierarchy/hierarchy.service';
import { RolesService } from '../users/roles.service';
import type { GroupRole } from './groups.dto';

export interface GroupView {
  /** The viewer's membership role, if they are a member. */
  role: GroupRole | null;
  /** Super admin or moderator. */
  admin: boolean;
  /** Above the group admin in the management line: sees, doesn't join (BR-GRP-4). */
  chain: boolean;
}

export const canViewGroup = (v: GroupView) => v.admin || !!v.role || v.chain;
/** Members, gatherings, attendance and reminders (BR-GRP-10). */
export const canManageGroup = (v: GroupView) =>
  v.admin || v.role === 'ADMIN' || v.role === 'MODERATOR';
/** Hand over the admin role, appoint and remove moderators (BR-GRP-2). */
export const canManageRoles = (v: GroupView) => v.admin || v.role === 'ADMIN';

export const groupNotFound = () =>
  new AppException(404, { code: 'NOT_FOUND', title: 'Group not found' });

/** Who may see or run a group: relationship checks, never a stored role list. */
@Injectable()
export class GroupAccess {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roles: RolesService,
    private readonly hierarchy: HierarchyService,
  ) {}

  async viewOf(viewerId: string, groupId: string): Promise<GroupView> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: {
        memberships: {
          where: { OR: [{ userId: viewerId }, { role: 'ADMIN' }] },
          select: { userId: true, role: true },
        },
      },
    });
    if (!group) throw groupNotFound();
    const role =
      group.memberships.find((m) => m.userId === viewerId)?.role ?? null;
    const admin = await this.roles.isAdmin(viewerId);
    const groupAdmin = group.memberships.find((m) => m.role === 'ADMIN');
    const chain =
      !role &&
      !admin &&
      !!groupAdmin &&
      (await this.hierarchy.isManagerAbove(
        this.prisma,
        groupAdmin.userId,
        viewerId,
      ));
    return { role, admin, chain };
  }

  async assertView(viewerId: string, groupId: string): Promise<GroupView> {
    const view = await this.viewOf(viewerId, groupId);
    if (!canViewGroup(view)) throw groupNotFound();
    return view;
  }

  async assertManage(viewerId: string, groupId: string): Promise<GroupView> {
    const view = await this.assertView(viewerId, groupId);
    if (!canManageGroup(view)) throw forbidden();
    return view;
  }

  async assertManageRoles(
    viewerId: string,
    groupId: string,
  ): Promise<GroupView> {
    const view = await this.assertView(viewerId, groupId);
    if (!canManageRoles(view)) throw forbidden();
    return view;
  }
}
