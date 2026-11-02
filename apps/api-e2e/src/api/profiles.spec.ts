import {
  closeDb,
  createMentorship,
  createUser,
  signedIn,
} from '../support/fixtures';

afterAll(closeDb);

describe('profiles and admin notes', () => {
  it('lets the manager chain, the mentor and admins keep notes the user never sees', async () => {
    const moderator = await signedIn(
      (await createUser({ moderator: true })).id,
    );
    const [top, mid, member, mentor, stranger] = await Promise.all([
      createUser({ moderator: true }),
      createUser({ moderator: true }),
      createUser({ moderator: true }),
      createUser(),
      createUser(),
    ]);
    await moderator.put(`/api/users/${mid.id}/manager`, { managerId: top.id });
    await moderator.put(`/api/users/${member.id}/manager`, {
      managerId: mid.id,
    });
    await createMentorship(mentor.id, member.id);

    const asTop = await signedIn(top.id);
    const asMentor = await signedIn(mentor.id);
    const asMember = await signedIn(member.id);
    const asStranger = await signedIn(stranger.id);

    // Two levels up still counts as managing.
    const written = await asTop.post(`/api/people/${member.id}/admin-notes`, {
      body: '  Ready to lead a group  ',
    });
    expect(written.status).toBe(200);
    expect(written.data).toMatchObject({
      body: 'Ready to lead a group',
      canEdit: true,
    });
    await asMentor.post(`/api/people/${member.id}/admin-notes`, {
      body: 'Steady progress',
    });

    for (const viewer of [asTop, asMentor, moderator]) {
      const notes = await viewer.get(`/api/people/${member.id}/admin-notes`);
      expect(notes.data).toHaveLength(2);
    }
    const mentorView = (
      await asMentor.get(`/api/people/${member.id}/admin-notes`)
    ).data;
    expect(
      mentorView.find(
        (n: { body: string }) => n.body === 'Ready to lead a group',
      ).canEdit,
    ).toBe(false);

    // The user themself and outsiders get nothing.
    for (const viewer of [asMember, asStranger]) {
      expect(
        (await viewer.get(`/api/people/${member.id}/admin-notes`)).status,
      ).toBe(403);
      expect(
        (
          await viewer.post(`/api/people/${member.id}/admin-notes`, {
            body: 'x',
          })
        ).status,
      ).toBe(403);
    }

    // Profiles: visible to the user and to those responsible, with the notes flag.
    expect((await asMember.get(`/api/people/${member.id}`)).data).toMatchObject(
      {
        manager: { id: mid.id },
        mentor: { id: mentor.id },
        canSeeAdminNotes: false,
      },
    );
    expect(
      (await asTop.get(`/api/people/${member.id}`)).data.canSeeAdminNotes,
    ).toBe(true);
    expect((await asStranger.get(`/api/people/${member.id}`)).status).toBe(403);

    // Only the author edits.
    const edit = await asMentor.patch(`/api/admin-notes/${written.data.id}`, {
      body: 'Changed',
    });
    expect(edit.status).toBe(403);
    const own = await asTop.patch(`/api/admin-notes/${written.data.id}`, {
      body: 'Ready to lead',
    });
    expect(own.data.body).toBe('Ready to lead');
  });
});
