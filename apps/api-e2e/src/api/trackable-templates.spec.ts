import {
  closeDb,
  createMentorship,
  createUser,
  signedIn,
  type TestUser,
} from '../support/fixtures';

afterAll(closeDb);

const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(
    new Date(),
  );

async function mentorWith(menteeCount: number) {
  const mentor = await createUser();
  const mentees: TestUser[] = [];
  for (let i = 0; i < menteeCount; i++) {
    const mentee = await createUser();
    await createMentorship(mentor.id, mentee.id);
    mentees.push(mentee);
  }
  return { mentor, mentees, as: await signedIn(mentor.id) };
}

/** A mentor's trackable, saved to the library. */
async function saved(isPublic: boolean) {
  const owner = await mentorWith(2);
  const trackable = (
    await owner.as.post('/api/trackables', {
      menteeId: owner.mentees[0].id,
      name: 'e2e Fajr in congregation',
      goal: 'Every day',
      type: 'BOOLEAN',
      cycle: 'DAILY',
    })
  ).data;
  const res = await owner.as.post(`/api/trackables/${trackable.id}/template`, {
    isPublic,
  });
  expect(res.status).toBe(200);
  return { owner, trackable: res.data, template: res.data.template };
}

describe('trackable library (BR-TRK-7…9, US-4.9)', () => {
  it('saves a trackable as a template it then follows, once', async () => {
    const { owner, trackable, template } = await saved(false);
    expect(template).toMatchObject({
      name: 'e2e Fajr in congregation',
      isPublic: false,
      author: { id: owner.mentor.id },
      uses: 1,
      canEdit: true,
      reshapable: true,
    });
    const again = await owner.as.post(
      `/api/trackables/${trackable.id}/template`,
      {},
    );
    expect(again.status).toBe(409);
    expect(again.data.code).toBe('TRACKABLE_FROM_TEMPLATE');
  });

  it('keeps private templates to their author and shares public ones with every mentor', async () => {
    const mine = await saved(false);
    const shared = await saved(true);
    const other = await mentorWith(1);
    const ids = (list: { id: string }[]) => list.map((t) => t.id);

    const forOwner = (await mine.owner.as.get('/api/trackable-templates')).data;
    expect(ids(forOwner)).toContain(mine.template.id);
    expect(ids(forOwner)).toContain(shared.template.id);
    // Mine come first.
    expect(forOwner[0].author.id).toBe(mine.owner.mentor.id);

    const forOther = (await other.as.get('/api/trackable-templates')).data;
    expect(ids(forOther)).not.toContain(mine.template.id);
    expect(
      forOther.find((t: { id: string }) => t.id === shared.template.id),
    ).toMatchObject({ canEdit: false, author: { id: shared.owner.mentor.id } });

    // Not a mentor: no library.
    const mentee = await signedIn(other.mentees[0].id);
    expect((await mentee.get('/api/trackable-templates')).status).toBe(403);
  });

  it('assigns a template to another mentee, once while it is active', async () => {
    const { template } = await saved(true);
    const other = await mentorWith(1);
    const menteeId = other.mentees[0].id;
    const res = await other.as.post(
      `/api/trackable-templates/${template.id}/assign`,
      { menteeId, startsOn: today() },
    );
    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({
      menteeId,
      name: 'e2e Fajr in congregation',
      type: 'BOOLEAN',
      template: { id: template.id, uses: 2, canEdit: false },
    });
    const list = (
      await other.as.get(`/api/trackable-templates?menteeId=${menteeId}`)
    ).data;
    expect(
      list.find((t: { id: string }) => t.id === template.id).assigned,
    ).toBe(true);
    const twice = await other.as.post(
      `/api/trackable-templates/${template.id}/assign`,
      { menteeId },
    );
    expect(twice.data.code).toBe('TEMPLATE_ALREADY_ASSIGNED');
    // Only for one's own mentees.
    const stranger = await mentorWith(1);
    expect(
      (
        await stranger.as.post(
          `/api/trackable-templates/${template.id}/assign`,
          { menteeId },
        )
      ).status,
    ).toBe(403);
  });

  it("refuses someone else's private template", async () => {
    const { template } = await saved(false);
    const other = await mentorWith(1);
    const res = await other.as.post(
      `/api/trackable-templates/${template.id}/assign`,
      { menteeId: other.mentees[0].id },
    );
    expect(res.status).toBe(404);
  });

  it('carries template edits to every linked trackable; the trackable keeps its own target', async () => {
    const { owner, trackable, template } = await saved(true);
    const second = (
      await owner.as.post(`/api/trackable-templates/${template.id}/assign`, {
        menteeId: owner.mentees[1].id,
      })
    ).data;

    // Shared fields change only through the template.
    const direct = await owner.as.patch(`/api/trackables/${trackable.id}`, {
      name: 'Renamed here',
    });
    expect(direct.data.code).toBe('TRACKABLE_FROM_TEMPLATE');

    const res = await owner.as.patch(
      `/api/trackable-templates/${template.id}`,
      { name: 'e2e Fajr on time', type: 'COUNT', cycle: 'WEEKLY', target: 5 },
    );
    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ name: 'e2e Fajr on time', target: 5 });
    for (const id of [trackable.id, second.id]) {
      expect((await owner.as.get(`/api/trackables/${id}`)).data).toMatchObject({
        name: 'e2e Fajr on time',
        type: 'COUNT',
        cycle: 'WEEKLY',
      });
    }
    const target = await owner.as.patch(`/api/trackables/${second.id}`, {
      target: 3,
    });
    expect(target.status).toBe(200);
    expect(target.data.target).toBe(3);

    // Someone else's template is read-only to other mentors.
    const otherMentor = await mentorWith(1);
    expect(
      (
        await otherMentor.as.patch(`/api/trackable-templates/${template.id}`, {
          name: 'Hijacked',
        })
      ).status,
    ).toBe(403);
  });

  it('fixes type and cycle once any linked trackable has an entry', async () => {
    const { owner, trackable, template } = await saved(false);
    await owner.as.put(`/api/trackables/${trackable.id}/entries/${today()}`, {
      value: 1,
    });
    const res = await owner.as.patch(
      `/api/trackable-templates/${template.id}`,
      { cycle: 'WEEKLY' },
    );
    expect(res.data.code).toBe('TRACKABLE_HAS_ENTRIES');
    expect(
      (
        await owner.as.patch(`/api/trackable-templates/${template.id}`, {
          goal: 'Fajr with the group',
          isPublic: true,
        })
      ).data,
    ).toMatchObject({
      goal: 'Fajr with the group',
      isPublic: true,
      reshapable: false,
    });
  });

  it('removes a template from the library and detaches its trackables', async () => {
    const { owner, trackable, template } = await saved(true);
    expect(
      (await owner.as.delete(`/api/trackable-templates/${template.id}`)).status,
    ).toBe(204);
    const after = (await owner.as.get(`/api/trackables/${trackable.id}`)).data;
    expect(after).toMatchObject({
      template: null,
      name: 'e2e Fajr in congregation',
    });
    const list = (await owner.as.get('/api/trackable-templates')).data;
    expect(list.map((t: { id: string }) => t.id)).not.toContain(template.id);
    // Now it's the mentee's own and can be renamed.
    expect(
      (
        await owner.as.patch(`/api/trackables/${trackable.id}`, {
          name: 'Fajr',
        })
      ).status,
    ).toBe(200);
  });
});
