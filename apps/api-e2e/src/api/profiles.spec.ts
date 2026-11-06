import {
  closeDb,
  createMentorship,
  createUser,
  notificationTypes,
  signedIn,
} from '../support/fixtures';

afterAll(closeDb);

describe('profiles and notes on a member (BR-NOTE-1, BR-NOTE-3)', () => {
  it('lets those above a member keep private notes the member and their peers never see', async () => {
    const moderator = await signedIn(
      (await createUser({ moderator: true })).id,
    );
    const [top, mid, member, mentor, grandMentor, peer, stranger] =
      await Promise.all([
        createUser({ moderator: true }),
        createUser({ moderator: true }),
        createUser({ moderator: true }),
        createUser(),
        createUser(),
        createUser(),
        createUser(),
      ]);
    await moderator.put(`/api/users/${mid.id}/manager`, { managerId: top.id });
    await moderator.put(`/api/users/${member.id}/manager`, {
      managerId: mid.id,
    });
    await createMentorship(mentor.id, member.id);
    await createMentorship(mentor.id, peer.id);
    await createMentorship(grandMentor.id, mentor.id);

    const asTop = await signedIn(top.id);
    const asMentor = await signedIn(mentor.id);
    const asGrandMentor = await signedIn(grandMentor.id);
    const asMember = await signedIn(member.id);
    const asPeer = await signedIn(peer.id);
    const asStranger = await signedIn(stranger.id);

    // Two levels up the management line still counts.
    const written = await asTop.post('/api/notes', {
      menteeId: member.id,
      visibility: 'PRIVATE',
      body: '  Ready to lead a group  ',
    });
    expect(written.status).toBe(200);
    expect(written.data).toMatchObject({
      body: 'Ready to lead a group',
      visibility: 'PRIVATE',
    });
    await asMentor.post('/api/notes', {
      menteeId: member.id,
      visibility: 'SHARED',
      body: 'Steady progress',
    });
    // So does two levels up the mentoring chain.
    expect(
      (
        await asGrandMentor.post('/api/notes', {
          menteeId: member.id,
          visibility: 'PRIVATE',
          body: 'Watch the workload',
        })
      ).status,
    ).toBe(200);

    for (const viewer of [asTop, asMentor, asGrandMentor, moderator]) {
      const notes = await viewer.get(`/api/notes?menteeId=${member.id}`);
      expect(notes.data).toHaveLength(3);
    }
    // The member reads only the shared one.
    const own = await asMember.get(`/api/notes?menteeId=${member.id}`);
    expect(own.data.map((n: { body: string }) => n.body)).toEqual([
      'Steady progress',
    ]);

    // Peers (the same mentor's other mentee) and outsiders get nothing.
    for (const viewer of [asPeer, asStranger]) {
      expect(
        (await viewer.get(`/api/notes?menteeId=${member.id}`)).status,
      ).toBe(403);
      expect(
        (
          await viewer.post('/api/notes', {
            menteeId: member.id,
            visibility: 'PRIVATE',
            body: 'x',
          })
        ).status,
      ).toBe(403);
    }
    // The member can't write notes about themself.
    expect(
      (
        await asMember.post('/api/notes', {
          menteeId: member.id,
          visibility: 'SHARED',
          body: 'x',
        })
      ).status,
    ).toBe(403);

    // Profiles: visible to the member and to those above, with the notes flag.
    expect((await asMember.get(`/api/people/${member.id}`)).data).toMatchObject(
      {
        manager: { id: mid.id },
        mentor: { id: mentor.id },
        canWriteNotes: false,
      },
    );
    expect(
      (await asTop.get(`/api/people/${member.id}`)).data.canWriteNotes,
    ).toBe(true);
    expect((await asStranger.get(`/api/people/${member.id}`)).status).toBe(403);

    // Only the author edits.
    const edit = await asMentor.patch(`/api/notes/${written.data.id}`, {
      body: 'Changed',
    });
    expect(edit.status).toBe(403);
    const mine = await asTop.patch(`/api/notes/${written.data.id}`, {
      body: 'Ready to lead',
    });
    expect(mine.data.body).toBe('Ready to lead');
  });

  it('tell people mentioned in a note who may read it, and name those who can’t', async () => {
    const [mentor, mentee, peer] = await Promise.all([
      createUser(),
      createUser(),
      createUser(),
    ]);
    const moderator = await createUser({ moderator: true });
    await createMentorship(mentor.id, mentee.id);
    await createMentorship(mentor.id, peer.id);
    // The peer can sign in, so only access decides whether they hear of it.
    await createMentorship(peer.id, (await createUser()).id);
    const asMentor = await signedIn(mentor.id);

    const check = await asMentor.get(
      `/api/notes/mention-access?menteeId=${mentee.id}&visibility=PRIVATE&userIds=${moderator.id}&userIds=${peer.id}`,
    );
    expect(check.data).toEqual({ blocked: [peer.id] });

    await asMentor.post('/api/notes', {
      menteeId: mentee.id,
      visibility: 'PRIVATE',
      body: `For @[Mod](${moderator.id}) and @[Peer](${peer.id})`,
    });
    expect(await notificationTypes(moderator.id)).toEqual(['MENTIONED']);
    expect(await notificationTypes(peer.id)).not.toContain('MENTIONED');
  });
});
