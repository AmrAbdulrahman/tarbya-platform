import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService } from '@tarbya/db';
import { normalizeSearch, plainMentions } from '@tarbya/shared';
import { AppException } from '../../common/app-exception';
import { impersonation } from '../../common/request-context';
import { EventsService } from '../events/events.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AvatarsService } from '../files/avatars.service';
import { StorageService } from '../files/storage.service';
import type {
  AttachmentDto,
  ConversationDto,
  ConversationRefDto,
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

const attachmentSelect = {
  id: true,
  conversationId: true,
  name: true,
  file: { select: { mime: true, size: true } },
} satisfies Prisma.MessageAttachmentSelect;

const toAttachment = (
  a: Prisma.MessageAttachmentGetPayload<{ select: typeof attachmentSelect }>,
): AttachmentDto => ({
  id: a.id,
  name: a.name,
  mime: a.file.mime,
  size: a.file.size,
  url: `/api/conversations/${a.conversationId}/attachments/${a.id}`,
});

const messageSelect = {
  id: true,
  conversationId: true,
  body: true,
  createdAt: true,
  author: person,
  impersonator: ref,
  attachments: { select: attachmentSelect, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.MessageSelect;

const toMessage = (
  m: Prisma.MessageGetPayload<{ select: typeof messageSelect }>,
): MessageDto => ({
  ...m,
  author: toPerson(m.author),
  attachments: m.attachments.map(toAttachment),
  createdAt: m.createdAt.toISOString(),
});

/** The list's and emails' preview: the text, or the first file's name. */
const previewOf = (body: string, files: { name: string }[]) =>
  plainMentions(body) || (files[0] ? `📎 ${files[0].name}` : '');

/** Up to 20 MB a file, 10 files a message. */
export const ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;
/** Shown in the page; anything else downloads. SVG can carry script, so it never shows inline. */
const INLINE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

/** One conversation per pair, whoever opened it. */
export const directKey = (a: string, b: string) => [a, b].sort().join(':');

const notFound = () =>
  new AppException(404, { code: 'NOT_FOUND', title: 'Conversation not found' });
const userNotFound = () =>
  new AppException(404, { code: 'NOT_FOUND', title: 'User not found' });

/**
 * One-to-one conversations between any two active members, opened for every
 * mentor and mentee; one per group; and group chats anyone starts (BR-MSG-1,
 * BR-MSG-2, BR-MSG-4). Members of a group or chat see messages from when they
 * joined. Every list is filtered in SQL.
 */
@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
  ) {}

  /** Conversations the user takes part in: their own directs and chats, and their groups'. */
  private visible(userId: string): Prisma.ConversationWhereInput {
    return {
      OR: [
        { kind: { in: ['DIRECT', 'CHAT'] }, members: { some: { userId } } },
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
   * In a group or chat, history from before they joined doesn't count.
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
          OR (c.kind = 'CHAT' AND cm."userId" IS NOT NULL
            AND m."createdAt" > COALESCE(cm."lastReadAt", cm."createdAt"))
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
    const [rows, unread, mentorships, joined] = await Promise.all([
      this.prisma.conversation.findMany({
        where: this.visible(userId),
        select: {
          id: true,
          kind: true,
          title: true,
          _count: { select: { members: true } },
          members: {
            where: { userId: { not: userId } },
            select: {
              user: { select: { ...person.select, deactivatedAt: true } },
            },
          },
          group: {
            select: {
              id: true,
              name: true,
              _count: { select: { memberships: true } },
            },
          },
          messages: {
            select: {
              body: true,
              createdAt: true,
              author: ref,
              attachments: { select: { name: true }, take: 1 },
            },
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
      this.joinedAt(userId),
    ]);
    const relationTo = (otherId: string) => {
      const m = mentorships.find(
        (x) => x.mentorId === otherId || x.menteeId === otherId,
      );
      if (!m) return null;
      return m.mentorId === otherId
        ? ('MY_MENTOR' as const)
        : ('MY_MENTEE' as const);
    };
    return rows.map((c) => {
      const other = c.kind === 'DIRECT' ? c.members[0]?.user : undefined;
      const relation = other ? relationTo(other.id) : null;
      // Nothing from before the user joined, not even as the preview.
      const since = joined.get(c.id);
      const last =
        c.messages[0] && (!since || c.messages[0].createdAt >= since)
          ? c.messages[0]
          : undefined;
      return {
        id: c.id,
        kind: c.kind,
        other: other ? toPerson(other) : null,
        relation,
        group: c.group && { id: c.group.id, name: c.group.name },
        title: c.title,
        memberCount:
          c.kind === 'CHAT'
            ? c._count.members
            : (c.group?._count.memberships ?? null),
        lastMessage: last
          ? {
              body: previewOf(last.body, last.attachments),
              author: last.author,
              at: last.createdAt.toISOString(),
            }
          : null,
        unread: unread.get(c.id) ?? 0,
        canPost: c.kind !== 'DIRECT' || (!!other && !other.deactivatedAt),
      };
    });
  }

  /** When the user joined each of their groups' and chats' conversations. */
  private async joinedAt(userId: string): Promise<Map<string, Date>> {
    const [chats, groups] = await Promise.all([
      this.prisma.conversationMember.findMany({
        where: { userId, conversation: { kind: 'CHAT' } },
        select: { conversationId: true, createdAt: true },
      }),
      this.prisma.groupMembership.findMany({
        where: { userId, group: { conversation: { isNot: null } } },
        select: {
          createdAt: true,
          group: { select: { conversation: { select: { id: true } } } },
        },
      }),
    ]);
    const map = new Map(chats.map((m) => [m.conversationId, m.createdAt]));
    for (const g of groups) {
      if (g.group.conversation) map.set(g.group.conversation.id, g.createdAt);
    }
    return map;
  }

  /** Starts a chat named `title` with the creator and the people picked. */
  async createChat(
    userId: string,
    title: string,
    userIds: string[],
  ): Promise<ConversationRefDto> {
    const others = await this.activeUsers(userIds, userId);
    if (!others.length) throw userNotFound();
    return this.prisma.conversation.create({
      data: {
        kind: 'CHAT',
        title,
        members: {
          create: [userId, ...others].map((id) => ({ userId: id })),
        },
      },
      select: { id: true },
    });
  }

  /** Who takes part, the viewer included, by name. */
  async members(userId: string, id: string) {
    const { participants } = await this.access(userId, id);
    const rows = await this.prisma.user.findMany({
      where: { id: { in: participants } },
      select: person.select,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toPerson);
  }

  /** Adds people to a chat; they see what's written from now on. */
  async addMembers(
    userId: string,
    id: string,
    userIds: string[],
  ): Promise<void> {
    const { kind, participants } = await this.access(userId, id);
    if (kind !== 'CHAT') throw notFound();
    const added = (await this.activeUsers(userIds, userId)).filter(
      (u) => !participants.includes(u),
    );
    if (!added.length) return;
    await this.prisma.conversationMember.createMany({
      data: added.map((u) => ({ conversationId: id, userId: u })),
      skipDuplicates: true,
    });
    this.events.publish([...participants, ...added], {
      type: 'message',
      conversationId: id,
    });
  }

  /** Leaves a chat; the last one out leaves it empty, and nobody sees it any more. */
  async leave(userId: string, id: string): Promise<void> {
    const { kind, participants } = await this.access(userId, id);
    if (kind !== 'CHAT') throw notFound();
    await this.prisma.conversationMember.delete({
      where: { conversationId_userId: { conversationId: id, userId } },
    });
    this.events.publish(participants, { type: 'message', conversationId: id });
  }

  /** The active users among `ids`, apart from `except`. */
  private async activeUsers(ids: string[], except: string): Promise<string[]> {
    const rows = await this.prisma.user.findMany({
      where: { id: { in: ids, not: except }, deactivatedAt: null },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  /** Stores a file the user is about to send here; it waits for `send` to carry it. */
  async upload(
    userId: string,
    id: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
  ): Promise<AttachmentDto> {
    const { canPost } = await this.access(userId, id);
    if (!canPost) {
      throw new AppException(409, {
        code: 'CONVERSATION_CLOSED',
        title: 'The conversation is read-only',
      });
    }
    // Multer reads the name as Latin-1; browsers send UTF-8, as Arabic names need.
    const name =
      Buffer.from(file.originalname, 'latin1').toString('utf8').slice(0, 200) ||
      'file';
    const mime = file.mimetype || 'application/octet-stream';
    const key = `attachments/${id}/${randomUUID()}`;
    await this.storage.put(key, file.buffer, mime);
    const row = await this.prisma.messageAttachment.create({
      data: {
        conversation: { connect: { id } },
        uploader: { connect: { id: userId } },
        name,
        file: { create: { key, mime, size: file.buffer.length } },
      },
      select: attachmentSelect,
    });
    return toAttachment(row);
  }

  /**
   * A file for someone in the conversation: sent in a message they may read
   * (from when they joined), or their own upload not sent yet.
   */
  async attachment(userId: string, id: string, attachmentId: string) {
    const { since } = await this.access(userId, id);
    const row = await this.prisma.messageAttachment.findFirst({
      where: {
        id: attachmentId,
        conversationId: id,
        OR: [
          {
            message: since
              ? { is: { createdAt: { gte: since } } }
              : { isNot: null },
          },
          { messageId: null, uploaderId: userId },
        ],
      },
      select: { name: true, file: { select: { key: true, mime: true } } },
    });
    if (!row) {
      throw new AppException(404, {
        code: 'NOT_FOUND',
        title: 'File not found',
      });
    }
    return {
      stream: await this.storage.get(row.file.key),
      name: row.name,
      mime: row.file.mime,
      inline: INLINE_TYPES.has(row.file.mime),
    };
  }

  /** Active members the user can start a conversation with, by name or email. */
  async contacts(userId: string, q?: string) {
    const rows = await this.prisma.user.findMany({
      where: {
        id: { not: userId },
        deactivatedAt: null,
        ...(q && {
          OR: [
            { nameSearch: { contains: normalizeSearch(q) } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        }),
      },
      select: person.select,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: 10,
    });
    return rows.map(toPerson);
  }

  /** The conversation with `otherId`, opened if it doesn't exist yet. */
  async direct(userId: string, otherId: string): Promise<ConversationRefDto> {
    const other = await this.prisma.user.findFirst({
      where: { id: otherId, deactivatedAt: null },
      select: { id: true },
    });
    if (!other || otherId === userId) throw userNotFound();
    const key = directKey(userId, otherId);
    const existing = await this.prisma.conversation.findUnique({
      where: { directKey: key },
      select: { id: true },
    });
    if (existing) return existing;
    try {
      return await this.prisma.conversation.create({
        data: {
          kind: 'DIRECT',
          directKey: key,
          members: {
            create: [{ userId }, { userId: otherId }],
          },
        },
        select: { id: true },
      });
    } catch (e) {
      // Opened by the other person at the same moment.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        return this.prisma.conversation.findUniqueOrThrow({
          where: { directKey: key },
          select: { id: true },
        });
      }
      throw e;
    }
  }

  async messages(
    userId: string,
    id: string,
    query: MessagesQuery,
  ): Promise<MessagePageDto> {
    const { since } = await this.access(userId, id);
    const limit = query.limit ?? 50;
    const rows = await this.prisma.message.findMany({
      where: {
        conversationId: id,
        createdAt: {
          ...(since && { gte: since }),
          ...(query.before && { lt: new Date(query.before) }),
        },
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

  async send(
    userId: string,
    id: string,
    body: string,
    attachmentIds: string[] = [],
  ): Promise<MessageDto> {
    const { kind, canPost, participants } = await this.access(userId, id);
    if (!canPost) {
      throw new AppException(409, {
        code: 'CONVERSATION_CLOSED',
        title:
          'The other person is no longer active; the conversation is read-only',
      });
    }
    // Only the sender's own, unsent uploads to this conversation.
    const files = attachmentIds.length
      ? await this.prisma.messageAttachment.findMany({
          where: {
            id: { in: attachmentIds },
            conversationId: id,
            uploaderId: userId,
            messageId: null,
          },
          select: { id: true, name: true },
        })
      : [];
    if (
      files.length !== new Set(attachmentIds).size ||
      (!body && !files.length)
    ) {
      throw new AppException(400, {
        code: 'VALIDATION_FAILED',
        title: 'Write something or attach a file you uploaded here',
        errors: { body: ['empty message or unknown attachment'] },
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
          attachments: { connect: files.map((f) => ({ id: f.id })) },
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
    if (kind !== 'DIRECT') {
      // In a group or chat, people mentioned who take part are told.
      const c = await this.prisma.conversation.findUniqueOrThrow({
        where: { id },
        select: { title: true, group: { select: { name: true } } },
      });
      await this.notifications.notifyMentions(
        userId,
        body,
        async (other) => participants.includes(other),
        { conversationId: id, title: c.title ?? c.group?.name ?? '' },
      );
    }
    if (caughtUp) {
      await this.notifications.notify(
        others,
        'NEW_MESSAGE',
        {
          conversationId: id,
          byName: message.author.name,
          preview: previewOf(body, files).slice(0, 200),
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

  /**
   * The conversation if the user takes part: whether they may post, who's in
   * it, and since when they may read it (a group or chat: from joining).
   */
  async access(userId: string, id: string) {
    const c = await this.prisma.conversation.findFirst({
      where: { id, ...this.visible(userId) },
      select: {
        kind: true,
        members: { select: { userId: true, createdAt: true } },
        group: {
          select: {
            memberships: { select: { userId: true, createdAt: true } },
          },
        },
      },
    });
    if (!c) throw notFound();
    if (c.kind === 'GROUP') {
      const memberships = c.group?.memberships ?? [];
      return {
        kind: c.kind,
        canPost: true,
        participants: memberships.map((m) => m.userId),
        since: memberships.find((m) => m.userId === userId)?.createdAt ?? null,
      };
    }
    const ids = c.members.map((m) => m.userId);
    if (c.kind === 'CHAT') {
      return {
        kind: c.kind,
        canPost: true,
        participants: ids,
        since: c.members.find((m) => m.userId === userId)?.createdAt ?? null,
      };
    }
    const inactive = await this.prisma.user.count({
      where: { id: { in: ids }, deactivatedAt: { not: null } },
    });
    return {
      kind: c.kind,
      canPost: inactive === 0,
      participants: ids,
      since: null,
    };
  }
}
