import { deliveryFor, notificationLink } from './notifications.js';

describe('deliveryFor (US-2.4, BR-NTF-1)', () => {
  it('uses the default until the user chooses', () => {
    expect(deliveryFor('CONTACT_DUE')).toEqual({ inApp: true, email: false });
    expect(deliveryFor('CONTACT_DUE', { email: true })).toEqual({
      inApp: true,
      email: true,
    });
    expect(deliveryFor('NEW_MESSAGE')).toEqual({ inApp: false, email: true });
  });

  it('keeps mandatory types in-app whatever the choice', () => {
    expect(
      deliveryFor('MENTORSHIP_ASSIGNED', { inApp: false, email: false }),
    ).toEqual({ inApp: true, email: false });
  });
});

describe('notificationLink', () => {
  it('sends a mentor to the mentee and the mentee to their journey', () => {
    const payload = { menteeId: 'm' };
    expect(notificationLink('CHALLENGE_RAISED', payload, 'mentor')).toBe(
      '/people/m',
    );
    expect(notificationLink('CHALLENGE_RAISED', payload, 'm')).toBe('/my');
  });

  it('opens the gathering on its group page', () => {
    expect(
      notificationLink(
        'GATHERING_RSVP_REQUEST',
        { groupId: 'g', gatheringId: 'x' },
        'u',
      ),
    ).toBe('/groups/g?gathering=x');
  });
});
