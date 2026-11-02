import { sectionsFor } from './nav';

describe('sectionsFor', () => {
  it('shows only the sections for the roles a user holds', () => {
    expect(sectionsFor(['MODERATOR']).map((s) => s.title)).toEqual([
      'nav.admin',
    ]);
    expect(sectionsFor(['MENTOR', 'MENTEE']).map((s) => s.title)).toEqual([
      'nav.myMentees',
      'nav.myJourney',
    ]);
  });

  it('shows nothing for a user with no roles', () => {
    expect(sectionsFor([])).toEqual([]);
  });
});
