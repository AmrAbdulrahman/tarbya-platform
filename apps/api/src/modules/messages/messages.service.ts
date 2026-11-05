import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService } from '@tarbya/db';
import { AppException } from '../../common/app-exception';
import { impersonation } from '../../common/request-context';
import { EventsService } from '../events/events.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AvatarsService } from '../files/avatars.service';
import type {
  ConversationDto,
  MessageDto,
  MessagePageDto,
  MessagesQuery,
  UnreadDto,
} from './messages.dto';

const ref = { select: { id: true, name: true } } as const;
const person = {
  select: { id: true, name: true, avatarFileId: true },
} as const;
const toPerson = (u: {
  id: string;
  name: string;
  avatarFileId: string | null;
}) => ({
  id: u.id,
  name: u.name,
  avatarUrl: AvatarsService.url(u.id, u.avatarFileId),
});

const messageSelect = {
  id: true,
  conversationId: true,
  body: true,
  createdAt: true,
  author: person,
  impersonator: ref,
} satisfies Prisma.MessageSelect;

const toMessage = (
  m: Prisma.MessageGetPayload<{ select: typeof messageSelect }>,
): MessageDto => ({
  ...m,
  author: toPerson(m.author),
  createdAt: m.createdAt.toISOString(),
});

/** One conversation per pair, whoever opened it. */
export const directKey = (a: string, b: string) => [a, b].sort().join(':');

const notFound = () =>
  new AppException(404, { code: 'NOT_FOUND', title: 'Conversation not found' });

/**
 * Mentor ↔ mentee conversations and one per group (BR-MSG-1, BR-MSG-2).
 * Who takes part is derived from mentorships and group membership, and every
 * list is filtered in SQL.
 */
@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Conversations the user takes part in: their own directs and their groups'. */
  private visible(userId: string): Prisma.ConversationWhereInput {
    return {
      OR: [
        { kind: 'DIRECT', members: { some: { userId } } },
        {
          kind: 'GROUP',
          group: { archivedAt: null, memberships: { some: { userId } } },
        },
      ],
    };
  }

  /** Every conversation the user can have exists, so the list shows them before the first message. */
  private async ensure(userId: string) {
    const [mentorships, groups] = await Promise.all([
      this.prisma.mentorship.findMany({
        where: {
          endedAt: null,
          OR: [{ mentorId: userId }, { menteeId: userId }],
        },
        select: { mentorId: true, menteeId: true },
      }),
      this.prisma.groupMembership.findMany({
        where: { userId, group: { archivedAt: null } },
        select: { groupId: true },
      }),
    ]);
    const pairs = mentorships.map((m) => ({
      key: directKey(m.mentorId, m.menteeId),
      ids: [m.mentorId, m.menteeId],
    }));
    const [direct, grouped] = await Promise.all([
      this.prisma.conversation.findMany({
        where: { directKey: { in: pairs.map((p) => p.key) } },
        select: { directKey: true },
      }),
      this.prisma.conversation.findMany({
        where: { groupId: { in: groups.map((g) => g.groupId) } },
        select: { groupId: true },
      }),
    ]);
    const haveDirect = new Set(direct.map((c) => c.directKey));
    const haveGroup = new Set(grouped.map((c) => c.groupId));
    const creates = [
      ...pairs
        .filter((p) => !haveDirect.has(p.key))
        .map((p) => ({
          kind: 'DIRECT' as const,
          directKey: p.key,
          members: { create: p.ids.map((id) => ({ userId: id })) },
        })),
      ...groups
        .filter((g) => !haveGroup.has(g.groupId))
        .map((g) => ({ kind: 'GROUP' as const, groupId: g.groupId })),
    ];
    for (const data of creates) {
      try {
        await this.prisma.conversation.create({ data });
      } catch (e) {
        // Another request created it first.
        if (
          !(e instanceof Prisma.PrismaClientKnownRequestError) ||
          e.code !== 'P2002'
        )
          throw e;
      }
    }
  }

  /**
   * Unread messages per conversation: from others, after the user last read it.
   * In a group, history from before they joined doesn't count.
   */
  private async unreadBy(userId: string): Promise<Map<string, number>> {
    const rows = await this.prisma.$queryRaw<{ id: string; n: number }[]>`
      SELECT m."conversationId" AS id, count(*)::int AS n
      FROM "Message" m
      JOIN "Conversation" c ON c.id = m."conversationId"
      LEFT JOIN "ConversationMember" cm
        ON cm."conversationId" = c.id AND cm."userId" = ${userId}::uuid
      LEFT JOIN "GroupMembership" gm
        ON c.kind = 'GROUP' AND gm."groupId" = c."groupId" AND gm."userId" = ${userId}::uuid
      LEFT JOIN "Group" g ON g.id = gm."groupId"
      WHERE m."authorId" <> ${userId}::uuid
        AND (
          (c.kind = 'DIRECT' AND cm."userId" IS NOT NULL
            AND (cm."lastReadAt" IS NULL OR m."createdAt" > cm."lastReadAt"))
          OR (c.kind = 'GROUP' AND gm.id IS NOT NULL AND g."archivedAt" IS NULL
            AND m."createdAt" > COALESCE(cm."lastReadAt", gm."createdAt"))
        )
      GROUP BY m."conversationId"`;
    return new Map(rows.map((r) => [r.id, r.n]));
  }

  async unread(userId: string): Promise<UnreadDto> {
    return { conversations: (await this.unreadBy(userId)).size };
  }

  /** Newest activity first; conversations without messages last. */
  async list(userId: string): Promise<ConversationDto[]> {
    await this.ensure(userId);
    const [rows, unread, mentorships] = await Promise.all([
      this.prisma.conversation.findMany({
        where: this.visible(userId),
        select: {
          id: true,
          kind: true,
          members: {
            where: { userId: { not: userId } },
            select: { user: person },
          },
          group: {
            select: {
              id: true,
              name: true,
              _count: { select: { memberships: true } },
            },
          },
          messages: {
            select: { body: true, createdAt: true, author: ref },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: [
          { lastMessageAt: { sort: 'desc', nulls: 'last' } },
          { createdAt: 'desc' },
        ],
      }),
      this.unreadBy(userId),
      this.prisma.mentorship.findMany({
        where: {
          endedAt: null,
          OR: [{ mentorId: userId }, { menteeId: userId }],
        },
        select: { mentorId: true, menteeId: true },
      }),
    ]);
    const relationTo = (otherId: string) => {
      const m = mentorships.find(
        (x) => x.mentorId === otherId || x.menteeId === otherId,
      );
      if (!m) return 'FORMER' as const;
      return m.mentorId === otherId
        ? ('MY_MENTOR' as const)
        : ('MY_MENTEE' as const);
    };
    return rows.map((c) => {
      const other = c.members[0]?.user;
      const relation =
        c.kind === 'DIRECT' && other ? relationTo(other.id) : null;
      const last = c.messages[0];
      return {
        id: c.id,
        kind: c.kind,
        other: other ? toPerson(other) : null,
        relation,
        group: c.group && { id: c.group.id, name: c.group.name },
        memberCount: c.group?._count.memberships ?? null,
        lastMessage: last
          ? {
              body: last.body,
              author: last.author,
              at: last.createdAt.toISOString(),
            }
          : null,
        unread: unread.get(c.id) ?? 0,
        canPost: c.kind === 'GROUP' || relation !== 'FORMER',
      };
    });
  }

  async messages(
    userId: string,
    id: string,
    query: MessagesQuery,
  ): Promise<MessagePageDto> {
    await this.access(userId, id);
    const limit = query.limit ?? 50;
    const rows = await this.prisma.message.findMany({
      where: {
        conversationId: id,
        ...(query.before && { createdAt: { lt: new Date(query.before) } }),
      },
      select: messageSelect,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    return {
      items: page.map(toMessage),
      nextCursor:
        rows.length > limit
          ? page[page.length - 1].createdAt.toISOString()
          : null,
    };
  }

  async send(userId: string, id: string, body: string): Promise<MessageDto> {
    const { kind, canPost, participants } = await this.access(userId, id);
    if (!canPost) {
      throw new AppException(409, {
        code: 'CONVERSATION_CLOSED',
        title: 'This mentorship has ended; the conversation is read-only',
      });
    }
    const now = new Date();
    // One notice per run of unread messages: only if the other person is up to date.
    const others = participants.filter((p) => p !== userId);
    const caughtUp =
      kind === 'DIRECT' ? await this.caughtUp(id, others[0]) : false;
    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId: id,
          authorId: userId,
          body,
          ...impersonation(),
        },
        select: messageSelect,
      }),
      this.prisma.conversation.update({
        where: { id },
        data: { lastMessageAt: now },
      }),
      this.prisma.conversationMember.upsert({
        where: { conversationId_userId: { conversationId: id, userId } },
        create: { conversationId: id, userId, lastReadAt: now },
        update: { lastReadAt: now },
      }),
    ]);
    this.events.publish(participants, { type: 'message', conversationId: id });
    if (caughtUp) {
      await this.notifications.notify(
        others,
        'NEW_MESSAGE',
        {
          conversationId: id,
          byName: message.author.name,
          preview: body.slice(0, 200),
        },
        { actorId: userId },
      );
    }
    return toMessage(message);
  }

  /** True when `userId` has read everything others wrote in the conversation. */
  private async caughtUp(id: string, userId: string): Promise<boolean> {
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: id, userId } },
      select: { lastReadAt: true },
    });
    const unread = await this.prisma.message.count({
      where: {
        conversationId: id,
        authorId: { not: userId },
        ...(member?.lastReadAt && { createdAt: { gt: member.lastReadAt } }),
      },
    });
    return unread === 0;
  }

  async markRead(userId: string, id: string): Promise<void> {
    await this.access(userId, id);
    const now = new Date();
    await this.prisma.conversationMember.upsert({
      where: { conversationId_userId: { conversationId: id, userId } },
      create: { conversationId: id, userId, lastReadAt: now },
      update: { lastReadAt: now },
    });
    // The user's other tabs clear their badge too.
    this.events.publish([userId], { type: 'read', conversationId: id });
  }

  /** The conversation if the user takes part, whether they may post, and who's in it. */
  async access(userId: string, id: string) {
    const c = await this.prisma.conversation.findFirst({
      where: { id, ...this.visible(userId) },
      select: {
        kind: true,
        members: { select: { userId: true } },
        group: { select: { memberships: { select: { userId: true } } } },
      },
    });
    if (!c) throw notFound();
    if (c.kind === 'GROUP') {
      return {
        kind: c.kind,
        canPost: true,
        participants: c.group?.memberships.map((m) => m.userId) ?? [],
      };
    }
    const ids = c.members.map((m) => m.userId);
    const active = await this.prisma.mentorship.count({
      where: {
        endedAt: null,
        OR: [
          { mentorId: ids[0], menteeId: ids[1] },
          { mentorId: ids[1], menteeId: ids[0] },
        ],
      },
    });
    return { kind: c.kind, canPost: active > 0, participants: ids };
  }
}
