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

describe('messages (US-7.3, BR-MSG-1, BR-MSG-2)', () => {
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

  it('keep others out and close the conversation when the mentorship ends', async () => {
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
    const closed = await asMentor.post(
      `/api/conversations/${direct?.id}/messages`,
      {
        body: 'Still there?',
      },
    );
    expect(closed.data.code).toBe('CONVERSATION_CLOSED');
    // The history stays, read-only.
    expect(
      (
        (await asMentor.get('/api/conversations')).data as {
          id: string;
          canPost: boolean;
        }[]
      ).find((c) => c.id === direct?.id),
    ).toMatchObject({ canPost: false });
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
  });
});
