import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService, type Prisma } from '@tarbya/db';
import { canSignIn, normalizeSearch, type Role } from '@tarbya/shared';
import { AppException } from '../../common/app-exception';
import type { Env } from '../../config/env';
import { AuditService, diffOf } from '../audit/audit.service';
import { AvatarsService } from '../files/avatars.service';
import { HierarchyService } from '../hierarchy/hierarchy.service';
import { SessionsService } from '../auth/sessions.service';
import { SettingsService } from '../settings/settings.service';
import { normalizeEmail } from '../auth/tokens';
import { roleFacts, RolesService } from './roles.service';
import type {
  CreateUserDto,
  ListUsersQuery,
  UpdateUserDto,
  UserDto,
  UserPageDto,
} from './users.dto';

const userSelect = {
  id: true,
  name: true,
  phone: true,
  locale: true,
  calendar: true,
  deactivatedAt: true,
  avatarFileId: true,
  manager: { select: { id: true, name: true } },
  ...roleFacts,
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof userSelect }>;

const notFound = () =>
  new AppException(404, { code: 'NOT_FOUND', title: 'User not found' });

/**
 * Typeahead by name, email or phone (BR-USR-6). Names match whatever form of
 * alef, yeh or diacritics was typed (`User.nameSearch`).
 */
export function personSearch(q: string): Prisma.UserWhereInput[] {
  const text = normalizeSearch(q);
  return [
    { nameSearch: { contains: text } },
    { email: { contains: text, mode: 'insensitive' } },
    // Only a query that looks like a phone number searches phones.
    ...(/^[+\d\s()-]+$/.test(text) && text.replace(/\D/g, '').length >= 3
      ? [{ phone: { contains: text.replace(/[^\d+]/g, '') } }]
      : []),
  ];
}

/** User administration (US-3.1, US-3.2, US-3.4). Every route is admin-only. */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roles: RolesService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly hierarchy: HierarchyService,
    private readonly sessions: SessionsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async list(query: ListUsersQuery): Promise<UserPageDto> {
    const limit = query.limit ?? 25;
    const where: Prisma.UserWhereInput = {
      ...(query.status === 'active' && { deactivatedAt: null }),
      ...(query.status === 'inactive' && { deactivatedAt: { not: null } }),
      ...(query.moderatorsOnly && { AND: [{ OR: this.canManageWhere() }] }),
      ...(query.q && { OR: personSearch(query.q) }),
    };
    const rows = await this.prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    });
    const allowed = await this.settings.get('auth.signInRoles');
    const page = rows.slice(0, limit);
    return {
      items: page.map((row) => this.toDto(row, allowed)),
      nextCursor: rows.length > limit ? page[page.length - 1].id : null,
    };
  }

  async get(id: string): Promise<UserDto> {
    const row = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });
    if (!row) throw notFound();
    return this.toDto(row, await this.settings.get('auth.signInRoles'));
  }

  async create(actorId: string, dto: CreateUserDto): Promise<UserDto> {
    const email = dto.email ? normalizeEmail(dto.email) : null;
    const phone = dto.phone ? normalizePhone(dto.phone) : null;
    const id = await this.prisma.$transaction(async (tx) => {
      await this.assertContactsFree(tx, { email, phone });
      const user = await tx.user.create({
        data: {
          name: dto.name,
          email,
          phone,
          locale: dto.locale,
          calendar: dto.calendar,
        },
      });
      await this.audit.record(
        {
          actorId,
          action: 'user.create',
          entity: 'User',
          entityId: user.id,
          diff: diffOf({} as Record<string, unknown>, {
            name: user.name,
            email,
            phone,
          }),
        },
        tx,
      );
      return user.id;
    });
    return this.get(id);
  }

  async update(
    actorId: string,
    id: string,
    dto: UpdateUserDto,
  ): Promise<UserDto> {
    await this.prisma.$transaction(async (tx) => {
      const before = await tx.user.findUnique({ where: { id } });
      if (!before) throw notFound();
      const next = {
        name: dto.name,
        email:
          dto.email === undefined
            ? undefined
            : dto.email && normalizeEmail(dto.email),
        phone:
          dto.phone === undefined
            ? undefined
            : dto.phone && normalizePhone(dto.phone),
        locale: dto.locale,
        calendar: dto.calendar,
      };
      // The super admin is whoever owns SUPER_ADMIN_EMAIL; changing it would hand the role away.
      if (
        next.email !== undefined &&
        next.email !== before.email &&
        this.roles.isSuperAdmin(before.email)
      ) {
        throw superAdminLocked();
      }
      await this.assertContactsFree(
        tx,
        {
          email: next.email !== before.email ? next.email : undefined,
          phone: next.phone !== before.phone ? next.phone : undefined,
        },
        id,
      );
      const diff = diffOf(before, next);
      if (!Object.keys(diff).length) return;
      await tx.user.update({ where: { id }, data: next });
      await this.audit.record(
        { actorId, action: 'user.update', entity: 'User', entityId: id, diff },
        tx,
      );
    });
    return this.get(id);
  }

  /** BR-USR-2: keeps everything, ends their sessions, and stops sign-in and assignment. */
  async setActive(
    actorId: string,
    id: string,
    active: boolean,
  ): Promise<UserDto> {
    if (!active && actorId === id) throw selfAction();
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id } });
      if (!user) throw notFound();
      if (!active && this.roles.isSuperAdmin(user.email))
        throw superAdminLocked();
      if (!!user.deactivatedAt === !active) return;
      await tx.user.update({
        where: { id },
        data: { deactivatedAt: active ? null : new Date() },
      });
      await this.audit.record(
        {
          actorId,
          action: active ? 'user.reactivate' : 'user.deactivate',
          entity: 'User',
          entityId: id,
        },
        tx,
      );
    });
    if (!active) await this.sessions.revokeAll(id);
    return this.get(id);
  }

  /** US-3.4: sets or clears the direct manager; refuses anything that would make a loop (BR-MGR-2). */
  async setManager(
    actorId: string,
    id: string,
    managerId: string | null,
  ): Promise<UserDto> {
    await this.prisma.$transaction(async (tx) => {
      // One hierarchy change at a time, so two moves can't form a loop between them.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('hierarchy'))`;
      const user = await tx.user.findUnique({ where: { id } });
      if (!user) throw notFound();
      if (user.managerId === managerId) return;
      if (managerId) {
        if (!user.isModerator) {
          throw new AppException(409, {
            code: 'MANAGER_NOT_MODERATOR',
            title: 'Only moderators have a direct manager',
          });
        }
        await this.assertCanManage(tx, managerId);
        if (await this.hierarchy.isInSubtree(tx, id, managerId)) {
          throw new AppException(409, {
            code: 'MANAGER_CYCLE',
            title: 'That manager reports to this user',
          });
        }
      }
      await tx.user.update({ where: { id }, data: { managerId } });
      await this.audit.record(
        {
          actorId,
          action: 'user.manager.set',
          entity: 'User',
          entityId: id,
          diff: { managerId: [user.managerId, managerId] },
        },
        tx,
      );
    });
    return this.get(id);
  }

  /** US-3.2: super admin only. */
  async setModerator(
    actorId: string,
    id: string,
    isModerator: boolean,
  ): Promise<UserDto> {
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id } });
      if (!user) throw notFound();
      if (this.roles.isSuperAdmin(user.email)) throw superAdminLocked();
      if (user.isModerator === isModerator) return;
      if (!isModerator && (await tx.user.count({ where: { managerId: id } }))) {
        throw new AppException(409, {
          code: 'MODERATOR_HAS_REPORTS',
          title: 'Move the people they manage first',
        });
      }
      // Only moderators have managers, so a former moderator leaves the management line.
      const managerId = isModerator ? user.managerId : null;
      await tx.user.update({ where: { id }, data: { isModerator, managerId } });
      await this.audit.record(
        {
          actorId,
          action: 'user.moderator.set',
          entity: 'User',
          entityId: id,
          diff: {
            isModerator: [user.isModerator, isModerator],
            ...(managerId !== user.managerId && {
              managerId: [user.managerId, managerId],
            }),
          },
        },
        tx,
      );
    });
    return this.get(id);
  }

  private toDto(row: UserRow, allowed: Role[]): UserDto {
    const roles = this.roles.rolesFrom(row);
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      locale: row.locale,
      calendar: row.calendar,
      isModerator: row.isModerator,
      roles,
      manager: row.manager,
      avatarUrl: AvatarsService.url(row.id, row.avatarFileId),
      deactivatedAt: row.deactivatedAt?.toISOString() ?? null,
      canSignIn: !row.deactivatedAt && !!row.email && canSignIn(roles, allowed),
    };
  }

  /** BR-USR-1: email and phone are unique when present. */
  private async assertContactsFree(
    tx: Prisma.TransactionClient,
    { email, phone }: { email?: string | null; phone?: string | null },
    exceptId?: string,
  ) {
    const not = exceptId ? { id: { not: exceptId } } : {};
    if (email && (await tx.user.count({ where: { email, ...not } }))) {
      throw new AppException(409, {
        code: 'USER_EMAIL_TAKEN',
        title: 'Another user has this email',
      });
    }
    if (phone && (await tx.user.count({ where: { phone, ...not } }))) {
      throw new AppException(409, {
        code: 'USER_PHONE_TAKEN',
        title: 'Another user has this phone',
      });
    }
  }

  /** Managers are active moderators or the super admin (BR-MGR-1). */
  private async assertCanManage(
    tx: Prisma.TransactionClient,
    managerId: string,
  ) {
    const manager = await tx.user.findUnique({ where: { id: managerId } });
    if (!manager || manager.deactivatedAt) {
      throw new AppException(409, {
        code: 'MANAGER_INACTIVE',
        title: 'The manager must be an active user',
      });
    }
    if (!manager.isModerator && !this.roles.isSuperAdmin(manager.email)) {
      throw new AppException(409, {
        code: 'MANAGER_NOT_MODERATOR',
        title: 'The manager must be a moderator',
      });
    }
  }

  private canManageWhere(): Prisma.UserWhereInput[] {
    return [
      { isModerator: true },
      {
        email: {
          equals: this.config.get('SUPER_ADMIN_EMAIL', { infer: true }),
          mode: 'insensitive',
        },
      },
    ];
  }
}

/** Keeps a leading + and the digits, so "+20 100-123 4567" and "+201001234567" match. */
export function normalizePhone(phone: string): string {
  return phone.trim().replace(/(?!^\+)[^\d]/g, '');
}

const superAdminLocked = () =>
  new AppException(409, {
    code: 'SUPER_ADMIN_LOCKED',
    title:
      'The super admin is set by the environment and cannot be changed here',
  });

const selfAction = () =>
  new AppException(409, {
    code: 'SELF_ACTION',
    title: "You can't do that to your own account",
  });
