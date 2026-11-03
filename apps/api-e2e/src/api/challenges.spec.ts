import {
  closeDb,
  createMentorship,
  createUser,
  markTaskDoneDaysAgo,
  signedIn,
} from '../support/fixtures';

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

describe('challenges (BR-CHL-1…3)', () => {
  it('are raised by the mentor, discussed by both, and resolved or reopened', async () => {
    const { mentor, mentee, asMentor, asMentee } = await pair();
    expect(
      (
        await asMentee.post('/api/challenges', {
          menteeId: mentee.id,
          title: 'x',
        })
      ).status,
    ).toBe(403);

    const created = await asMentor.post('/api/challenges', {
      menteeId: mentee.id,
      title: '  Exam stress ',
    });
    expect(created.data).toMatchObject({
      title: 'Exam stress',
      createdBy: { id: mentor.id },
      resolvedAt: null,
      comments: [],
    });

    const commented = await asMentee.post(
      `/api/challenges/${created.data.id}/comments`,
      { body: 'Slept better this week' },
    );
    expect(commented.data.comments).toEqual([
      expect.objectContaining({
        body: 'Slept better this week',
        author: expect.objectContaining({ id: mentee.id }),
      }),
    ]);

    expect(
      (
        await asMentee.patch(`/api/challenges/${created.data.id}`, {
          resolved: true,
        })
      ).status,
    ).toBe(403);
    const resolved = await asMentor.patch(
      `/api/challenges/${created.data.id}`,
      {
        resolved: true,
      },
    );
    expect(resolved.data.resolvedAt).not.toBeNull();
    expect(resolved.data.resolvedBy).toMatchObject({ id: mentor.id });
    const reopened = await asMentor.patch(
      `/api/challenges/${created.data.id}`,
      {
        resolved: false,
      },
    );
    expect(reopened.data).toMatchObject({ resolvedAt: null, resolvedBy: null });
  });

  it('are raised, commented on and resolved from a follow-up; open ones list first', async () => {
    const { mentee, asMentor, asMentee } = await pair();
    const older = (
      await asMentor.post('/api/challenges', {
        menteeId: mentee.id,
        title: 'Phone use',
      })
    ).data;
    const other = (
      await asMentor.post('/api/challenges', {
        menteeId: mentee.id,
        title: 'Fajr',
      })
    ).data;

    const followUp = await asMentor.post('/api/interactions/follow-ups', {
      menteeId: mentee.id,
      startsAt: new Date(Date.now() - 60_000).toISOString(),
      challenges: ['Family visit'],
      challengeNotes: [
        {
          challengeId: older.id,
          comment: 'Down to an hour a day',
          resolve: true,
        },
        { challengeId: other.id, comment: 'Twice this week' },
      ],
    });
    expect(followUp.status).toBe(200);
    expect(followUp.data.challenges).toEqual(['Family visit']);

    const list = (await asMentee.get(`/api/challenges?menteeId=${mentee.id}`))
      .data;
    expect(list.map((c: { title: string }) => c.title)).toEqual([
      'Family visit',
      'Fajr',
      'Phone use',
    ]);
    const phone = list.find((c: { id: string }) => c.id === older.id);
    expect(phone.resolvedAt).not.toBeNull();
    expect(phone.comments[0]).toMatchObject({
      body: 'Down to an hour a day',
      interactionId: followUp.data.id,
    });
    const raised = list.find(
      (c: { title: string }) => c.title === 'Family visit',
    );
    expect(raised.interactionId).toBe(followUp.data.id);
  });

  it("refuses notes on someone else's challenges, and strangers", async () => {
    const a = await pair();
    const b = await pair();
    const ofB = (
      await b.asMentor.post('/api/challenges', {
        menteeId: b.mentee.id,
        title: 'x',
      })
    ).data;
    const res = await a.asMentor.post('/api/interactions/follow-ups', {
      menteeId: a.mentee.id,
      startsAt: new Date(Date.now() - 60_000).toISOString(),
      challengeNotes: [{ challengeId: ofB.id, resolve: true }],
    });
    expect(res.data.errors).toHaveProperty('challengeNotes');
    expect(
      (await a.asMentor.get(`/api/challenges?menteeId=${b.mentee.id}`)).status,
    ).toBe(403);
    expect(
      (
        await a.asMentor.post(`/api/challenges/${ofB.id}/comments`, {
          body: 'x',
        })
      ).status,
    ).toBe(403);
  });
});

describe('tasks on their own (BR-FU-4)', () => {
  it('are added by the mentor with an optional due date; not by the mentee or strangers', async () => {
    const { mentee, asMentor, asMentee } = await pair();
    const task = await asMentor.post('/api/tasks', {
      assigneeId: mentee.id,
      title: 'Read chapter 3',
      dueOn: '2026-12-01',
    });
    expect(task.data).toMatchObject({
      title: 'Read chapter 3',
      dueOn: '2026-12-01',
      interactionId: null,
    });
    expect(
      (await asMentee.post('/api/tasks', { assigneeId: mentee.id, title: 'x' }))
        .status,
    ).toBe(403);
    const stranger = await signedIn((await createUser()).id);
    expect(
      (await stranger.post('/api/tasks', { assigneeId: mentee.id, title: 'x' }))
        .status,
    ).toBe(403);
    // Done tasks stay listed, after the open ones.
    await asMentee.patch(`/api/tasks/${task.data.id}`, { done: true });
    const all = (
      await asMentee.get(`/api/tasks?assigneeId=${mentee.id}&status=all`)
    ).data;
    expect(all[0]).toMatchObject({
      id: task.data.id,
      doneAt: expect.any(String),
    });
  });

  it('lists done tasks under "recent" for 7 days after they are done (BR-FU-4)', async () => {
    const { mentee, asMentor } = await pair();
    const mk = async (title: string) =>
      (await asMentor.post('/api/tasks', { assigneeId: mentee.id, title }))
        .data;
    const open = await mk('Open');
    const fresh = await mk('Done today');
    const old = await mk('Done long ago');
    await asMentor.patch(`/api/tasks/${fresh.id}`, { done: true });
    await asMentor.patch(`/api/tasks/${old.id}`, { done: true });
    await markTaskDoneDaysAgo(old.id, 8);
    const titles = async (status: string) =>
      (
        await asMentor.get(
          `/api/tasks?assigneeId=${mentee.id}&status=${status}`,
        )
      ).data.map((x: { title: string }) => x.title);
    expect(await titles('recent')).toEqual([open.title, fresh.title]);
    expect(await titles('all')).toHaveLength(3);
  });
});
