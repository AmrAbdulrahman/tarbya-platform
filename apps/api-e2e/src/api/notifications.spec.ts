import {
  closeDb,
  createMentorship,
  createUser,
  mailSubjects,
  signedIn,
  superAdminId,
} from '../support/fixtures';

afterAll(closeDb);
// Emails go through the job queue, which polls; give them time under a full run.
jest.setTimeout(30_000);

describe('notifications (US-7.1, US-7.2, US-2.4, BR-NTF-1…3)', () => {
  it('tell both sides of a new mentorship, in-app and by email, only if they can sign in', async () => {
    const asAdmin = await signedIn(await superAdminId());
    const mentor = await createUser();
    const mentee = await createUser();
    const res = await asAdmin.post('/api/mentorships', {
      mentorId: mentor.id,
      menteeId: mentee.id,
    });
    expect(res.status).toBe(200);

    // Mentors may sign in by default; mentees may not (BR-AUTH-2, BR-AUTH-4).
    const asMentor = await signedIn(mentor.id);
    const page = await asMentor.get('/api/notifications');
    expect(page.data.items).toEqual([
      expect.objectContaining({
        type: 'MENTORSHIP_ASSIGNED',
        category: 'mentees',
        link: `/people/${mentee.id}`,
        readAt: null,
        payload: expect.objectContaining({ menteeId: mentee.id }),
      }),
    ]);
    const menteePage = await (
      await signedIn(mentee.id)
    ).get('/api/notifications');
    expect(menteePage.data.items).toEqual([]);

    const [subject] = await mailSubjects(mentor.email);
    expect(subject).toContain('E2E');

    expect(
      (await asMentor.get('/api/notifications/unread-count')).data,
    ).toEqual({
      count: 1,
    });
    const id = page.data.items[0].id;
    expect((await asMentor.post(`/api/notifications/${id}/read`)).status).toBe(
      204,
    );
    expect(
      (await asMentor.get('/api/notifications/unread-count')).data.count,
    ).toBe(0);
    expect(
      (await asMentor.get('/api/notifications?filter=unread')).data.items,
    ).toEqual([]);
    expect(
      (await asMentor.get('/api/notifications?filter=groups')).data.items,
    ).toEqual([]);
    // Someone else's notification is not found.
    const outsider = await signedIn((await createUser()).id);
    expect((await outsider.post(`/api/notifications/${id}/read`)).status).toBe(
      404,
    );
  });

  it('follow each user’s choices; mandatory types stay on in-app', async () => {
    const mentor = await createUser();
    const mentee = await createUser();
    await createMentorship(mentor.id, mentee.id);
    const asMentor = await signedIn(mentor.id);
    const asMentee = await signedIn(mentee.id);

    const prefs = await asMentor.get('/api/notifications/preferences');
    expect(prefs.data).toContainEqual({
      type: 'MENTORSHIP_ASSIGNED',
      inApp: true,
      email: true,
      mandatory: true,
    });
    const saved = await asMentor.put('/api/notifications/preferences', {
      changes: [
        { type: 'MENTORSHIP_ASSIGNED', inApp: false, email: false },
        { type: 'CHALLENGE_COMMENTED', inApp: false, email: false },
      ],
    });
    expect(saved.data).toContainEqual(
      expect.objectContaining({
        type: 'MENTORSHIP_ASSIGNED',
        inApp: true,
        email: false,
      }),
    );

    // The mentor raises a challenge; the mentee's comment would notify the mentor, who opted out.
    const challenge = await asMentor.post('/api/challenges', {
      menteeId: mentee.id,
      title: 'Morning routine',
    });
    await asMentee.post(`/api/challenges/${challenge.data.id}/comments`, {
      body: 'Getting better',
    });
    const types = (
      (await asMentor.get('/api/notifications')).data.items as {
        type: string;
      }[]
    ).map((n) => n.type);
    expect(types).not.toContain('CHALLENGE_COMMENTED');

    await asMentor.put('/api/notifications/preferences', {
      changes: [{ type: 'CHALLENGE_COMMENTED', inApp: true, email: false }],
    });
    await asMentee.post(`/api/challenges/${challenge.data.id}/comments`, {
      body: 'Even better',
    });
    const after = await asMentor.get('/api/notifications?filter=journey');
    expect(after.data.items[0]).toMatchObject({
      type: 'CHALLENGE_COMMENTED',
      payload: expect.objectContaining({ preview: 'Even better' }),
    });
    expect((await asMentor.post('/api/notifications/read-all')).status).toBe(
      204,
    );
    expect(
      (await asMentor.get('/api/notifications/unread-count')).data.count,
    ).toBe(0);
  });

  it('email a new message once per unread run (BR-NTF-3 "new message")', async () => {
    const mentor = await createUser();
    const mentee = await createUser();
    await createMentorship(mentor.id, mentee.id);
    const asMentee = await signedIn(mentee.id);
    const asMentor = await signedIn(mentor.id);
    const conversation = (
      (await asMentee.get('/api/conversations')).data as {
        id: string;
        other: { id: string } | null;
      }[]
    ).find((c) => c.other?.id === mentor.id);
    await asMentee.post(`/api/conversations/${conversation?.id}/messages`, {
      body: 'Salam, I finished the surah',
    });
    await asMentee.post(`/api/conversations/${conversation?.id}/messages`, {
      body: 'And started the next one',
    });
    const subjects = await mailSubjects(mentor.email);
    expect(subjects.filter((s) => s.includes('E2E'))).toHaveLength(1);
    // Messages come by email only by default; the bell stays quiet.
    expect(
      (
        (await asMentor.get('/api/notifications')).data.items as {
          type: string;
        }[]
      ).map((n) => n.type),
    ).not.toContain('NEW_MESSAGE');

    // Once the mentor has read, the next message notifies again.
    await asMentor.post(`/api/conversations/${conversation?.id}/read`);
    await asMentee.post(`/api/conversations/${conversation?.id}/messages`, {
      body: 'Did you see?',
    });
    expect((await mailSubjects(mentor.email, 2)).length).toBe(2);
  });
});
