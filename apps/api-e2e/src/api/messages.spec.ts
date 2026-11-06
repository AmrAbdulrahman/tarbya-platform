import { request } from 'node:http';
import {
  closeDb,
  createMentorship,
  createUser,
  signedIn,
  superAdminId,
} from '../support/fixtures';
import type { Session } from '../support/session';

afterAll(closeDb);

async function pair() {
  const mentor = await createUser();
  const mentee = await createUser();
  await createMentorship(mentor.id, mentee.id);
  return {
    mentor,
    mentee,
    asMentor: await signedIn(mentor.id),
    asMentee: await signedIn(mentee.id),
  };
}

/** Opens the SSE stream and resolves with the first event whose data matches. */
function nextEvent(
  session: Session,
  match: (data: Record<string, unknown>) => boolean,
): {
  ready: Promise<void>;
  event: Promise<Record<string, unknown>>;
  close: () => void;
} {
  let close = () => undefined as void;
  let opened: () => void = () => undefined;
  const ready = new Promise<void>((r) => (opened = r));
  const event = new Promise<Record<string, unknown>>((resolve, reject) => {
    const req = request(
      {
        host: process.env['HOST'] ?? 'localhost',
        port: Number(process.env['PORT'] ?? 3000),
        path: '/api/events',
        headers: {
          Cookie: [...session.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
        },
      },
      (res) => {
        opened();
        let buffer = '';
        res.on('data', (chunk: Buffer) => {
          buffer += chunk.toString();
          for (const line of buffer.split('\n')) {
            if (!line.startsWith('data: ') || line === 'data: ') continue;
            const data = JSON.parse(line.slice(6));
            if (match(data)) resolve(data);
          }
        });
      },
    );
    req.on('error', reject);
    req.end();
    close = () => req.destroy();
  });
  return { ready, event, close };
}

describe('messages (US-7.3, BR-MSG-1, BR-MSG-2, BR-MSG-4)', () => {
  it('give each mentor and mentee one conversation, delivered live with unread counts', async () => {
    const { mentor, mentee, asMentor, asMentee } = await pair();
    const list = await asMentor.get('/api/conversations');
    const direct = (
      list.data as { id: string; other: { id: string } | null }[]
    ).find((c) => c.other?.id === mentee.id);
    expect(direct).toMatchObject({
      kind: 'DIRECT',
      relation: 'MY_MENTEE',
      unread: 0,
      canPost: true,
      lastMessage: null,
    });
    // The mentee sees the same conversation, with the mentor as their mentor.
    const theirs = await asMentee.get('/api/conversations');
    expect(theirs.data).toContainEqual(
      expect.objectContaining({ id: direct?.id, relation: 'MY_MENTOR' }),
    );

    const live = nextEvent(asMentee, (d) => d['type'] === 'message');
    await live.ready;
    const sent = await asMentor.post(
      `/api/conversations/${direct?.id}/messages`,
      {
        body: '  How was the revision this week? ',
      },
    );
    expect(sent.data).toMatchObject({
      body: 'How was the revision this week?',
      author: { id: mentor.id },
    });
    expect(await live.event).toEqual({
      type: 'message',
      conversationId: direct?.id,
    });
    live.close();

    expect((await asMentee.get('/api/conversations/unread')).data).toEqual({
      conversations: 1,
    });
    const page = await asMentee.get(
      `/api/conversations/${direct?.id}/messages`,
    );
    expect(page.data.items).toHaveLength(1);
    expect(
      (await asMentee.post(`/api/conversations/${direct?.id}/read`)).status,
    ).toBe(204);
    expect(
      (await asMentee.get('/api/conversations/unread')).data.conversations,
    ).toBe(0);
    // The sender's own messages never count as unread.
    expect(
      (await asMentor.get('/api/conversations/unread')).data.conversations,
    ).toBe(0);
  });

  it('keep others out, and keep the conversation open after the mentorship ends', async () => {
    const { mentee, asMentor } = await pair();
    const direct = (
      (await asMentor.get('/api/conversations')).data as {
        id: string;
        other: { id: string } | null;
      }[]
    ).find((c) => c.other?.id === mentee.id);
    const outsider = await signedIn((await createUser()).id);
    expect(
      (await outsider.get(`/api/conversations/${direct?.id}/messages`)).status,
    ).toBe(404);
    expect(
      (
        await outsider.post(`/api/conversations/${direct?.id}/messages`, {
          body: 'hi',
        })
      ).status,
    ).toBe(404);

    const asAdmin = await signedIn(await superAdminId());
    const active = (
      (await asAdmin.get('/api/mentorships')).data as {
        id: string;
        mentee: { id: string };
      }[]
    ).find((m) => m.mentee.id === mentee.id);
    expect(
      (await asAdmin.post(`/api/mentorships/${active?.id}/end`)).status,
    ).toBe(200);
    expect(
      (
        await asMentor.post(`/api/conversations/${direct?.id}/messages`, {
          body: 'Still there?',
        })
      ).status,
    ).toBe(200);
    expect(
      (
        (await asMentor.get('/api/conversations')).data as {
          id: string;
        }[]
      ).find((c) => c.id === direct?.id),
    ).toMatchObject({ relation: null, canPost: true });

    // Once the other person is deactivated, the history stays, read-only.
    expect(
      (await asAdmin.post(`/api/users/${mentee.id}/deactivate`)).status,
    ).toBe(200);
    const closed = await asMentor.post(
      `/api/conversations/${direct?.id}/messages`,
      { body: 'Hello?' },
    );
    expect(closed.data.code).toBe('CONVERSATION_CLOSED');
    expect(
      (
        (await asMentor.get('/api/conversations')).data as {
          id: string;
        }[]
      ).find((c) => c.id === direct?.id),
    ).toMatchObject({ canPost: false });
  });

  it('let any member start a conversation with any other active member', async () => {
    const tag = Date.now().toString(36);
    const a = await createUser();
    const b = await createUser({ name: `E2E أَحمد مصطفى ${tag}` });
    const gone = await createUser({ deactivated: true });
    const asA = await signedIn(a.id);

    // Any form of alef, yeh or diacritics finds the name.
    const found = await asA.get(
      `/api/conversations/contacts?q=${encodeURIComponent(`احمد مصطفي ${tag}`)}`,
    );
    expect(found.data).toEqual([expect.objectContaining({ id: b.id })]);

    const opened = await asA.post('/api/conversations/direct', {
      userId: b.id,
    });
    expect(opened.status).toBe(200);
    // Opening it again, from either side, finds the same conversation.
    const asB = await signedIn(b.id);
    expect(
      (await asB.post('/api/conversations/direct', { userId: a.id })).data,
    ).toEqual(opened.data);
    expect(
      (
        await asA.post(`/api/conversations/${opened.data.id}/messages`, {
          body: 'Salam',
        })
      ).status,
    ).toBe(200);
    expect(
      (
        (await asB.get('/api/conversations')).data as {
          id: string;
        }[]
      ).find((c) => c.id === opened.data.id),
    ).toMatchObject({
      kind: 'DIRECT',
      relation: null,
      canPost: true,
      unread: 1,
    });

    expect(
      (await asA.post('/api/conversations/direct', { userId: gone.id })).status,
    ).toBe(404);
    expect(
      (await asA.post('/api/conversations/direct', { userId: a.id })).status,
    ).toBe(404);
  });

  it('give each group one conversation for its members', async () => {
    const asAdmin = await signedIn(await superAdminId());
    const admin = await createUser();
    const { mentee } = await pair();
    const group = await asAdmin.post('/api/groups', {
      name: `e2e chat group ${Date.now().toString(36)}`,
      adminId: admin.id,
    });
    const asGroupAdmin = await signedIn(admin.id);
    await asGroupAdmin.post(`/api/groups/${group.data.id}/members`, {
      userId: mentee.id,
    });
    const conv = (
      (await asGroupAdmin.get('/api/conversations')).data as {
        id: string;
        group: { id: string } | null;
        memberCount: number | null;
      }[]
    ).find((c) => c.group?.id === group.data.id);
    expect(conv).toMatchObject({
      kind: 'GROUP',
      memberCount: 2,
      canPost: true,
    });
    await asGroupAdmin.post(`/api/conversations/${conv?.id}/messages`, {
      body: 'Lesson moves to the big hall',
    });
    const asMember = await signedIn(mentee.id);
    expect(
      (
        (await asMember.get('/api/conversations')).data as {
          id: string;
          unread: number;
        }[]
      ).find((c) => c.id === conv?.id)?.unread,
    ).toBe(1);
    const outsider = await signedIn((await createUser()).id);
    expect(
      (await outsider.get(`/api/conversations/${conv?.id}/messages`)).status,
    ).toBe(404);

    // Someone who joins later sees only what's written from then on.
    const { mentee: late } = await pair();
    await asGroupAdmin.post(`/api/groups/${group.data.id}/members`, {
      userId: late.id,
    });
    const asLate = await signedIn(late.id);
    const theirs = (
      (await asLate.get('/api/conversations')).data as {
        id: string;
        unread: number;
        lastMessage: unknown;
      }[]
    ).find((c) => c.id === conv?.id);
    expect(theirs).toMatchObject({ unread: 0, lastMessage: null });
    expect(
      (await asLate.get(`/api/conversations/${conv?.id}/messages`)).data.items,
    ).toEqual([]);
  });

  it('send files: uploaded first, then carried by a message, readable by the conversation only', async () => {
    const { mentee, asMentor, asMentee } = await pair();
    const conv = (
      (await asMentor.get('/api/conversations')).data as {
        id: string;
        other: { id: string } | null;
      }[]
    ).find((c) => c.other?.id === mentee.id);
    const data = new FormData();
    data.append(
      'file',
      new Blob([Buffer.from('lesson plan')], { type: 'text/plain' }),
      'خطة الدرس.txt',
    );
    const up = await asMentor.post(
      `/api/conversations/${conv?.id}/attachments`,
      data,
    );
    expect(up.status).toBe(200);
    expect(up.data).toMatchObject({
      name: 'خطة الدرس.txt',
      size: 11,
    });

    // Not readable by the other side until it's sent.
    expect((await asMentee.getBytes(up.data.url)).status).toBe(404);
    const sent = await asMentor.post(
      `/api/conversations/${conv?.id}/messages`,
      {
        body: '',
        attachmentIds: [up.data.id],
      },
    );
    expect(sent.status).toBe(200);
    expect(sent.data.attachments).toEqual([
      expect.objectContaining({ id: up.data.id }),
    ]);
    const file = await asMentee.getBytes(up.data.url);
    expect(file.status).toBe(200);
    // Not an image: it downloads rather than opening in the page.
    expect(file.headers['content-disposition']).toMatch(/^attachment/);
    expect(Buffer.from(file.data).toString()).toBe('lesson plan');
    expect(
      (
        (await asMentee.get('/api/conversations')).data as {
          id: string;
          lastMessage: { body: string } | null;
        }[]
      ).find((c) => c.id === conv?.id)?.lastMessage?.body,
    ).toBe('📎 خطة الدرس.txt');

    // Sent once only, and never an empty message.
    expect(
      (
        await asMentor.post(`/api/conversations/${conv?.id}/messages`, {
          body: '',
          attachmentIds: [up.data.id],
        })
      ).status,
    ).toBe(400);
    const outsider = await signedIn((await createUser()).id);
    expect((await outsider.getBytes(up.data.url)).status).toBe(404);
  });

  it('let anyone start a group chat and add people, who see it from when they joined', async () => {
    const [a, b, c] = await Promise.all([
      createUser(),
      createUser(),
      createUser(),
    ]);
    const gone = await createUser({ deactivated: true });
    const asA = await signedIn(a.id);
    const asB = await signedIn(b.id);
    const asC = await signedIn(c.id);

    const chat = await asA.post('/api/conversations/chats', {
      title: '  e2e trip planning ',
      userIds: [b.id, gone.id],
    });
    expect(chat.status).toBe(200);
    await asA.post(`/api/conversations/${chat.data.id}/messages`, {
      body: 'Before you joined',
    });
    expect(
      ((await asB.get('/api/conversations')).data as { id: string }[]).find(
        (x) => x.id === chat.data.id,
      ),
    ).toMatchObject({
      kind: 'CHAT',
      title: 'e2e trip planning',
      memberCount: 2,
      unread: 1,
      canPost: true,
    });
    // Outsiders can't read it or add themselves.
    expect(
      (await asC.get(`/api/conversations/${chat.data.id}/messages`)).status,
    ).toBe(404);
    expect(
      (
        await asC.post(`/api/conversations/${chat.data.id}/members`, {
          userIds: [c.id],
        })
      ).status,
    ).toBe(404);

    // Any member adds people.
    expect(
      (
        await asB.post(`/api/conversations/${chat.data.id}/members`, {
          userIds: [c.id],
        })
      ).status,
    ).toBe(204);
    await new Promise((r) => setTimeout(r, 20));
    await asB.post(`/api/conversations/${chat.data.id}/messages`, {
      body: 'Welcome',
    });
    const seen = (await asC.get(`/api/conversations/${chat.data.id}/messages`))
      .data.items as { body: string }[];
    expect(seen.map((m) => m.body)).toEqual(['Welcome']);
    expect(
      (
        (await asA.get(`/api/conversations/${chat.data.id}/members`)).data as {
          id: string;
        }[]
      )
        .map((m) => m.id)
        .sort(),
    ).toEqual([a.id, b.id, c.id].sort());

    // Leaving takes it off their list.
    expect(
      (await asC.delete(`/api/conversations/${chat.data.id}/members/me`))
        .status,
    ).toBe(204);
    expect(
      (await asC.get(`/api/conversations/${chat.data.id}/messages`)).status,
    ).toBe(404);
  });
});
