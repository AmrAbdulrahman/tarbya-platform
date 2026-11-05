import { homeFor, sectionsFor } from './nav';

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

  it('lists a link once, in the first section that has it', () => {
    const sections = sectionsFor(['MODERATOR', 'GROUP_ADMIN', 'MENTEE']);
    const groups = sections.flatMap((s) =>
      s.items.filter((i) => i.to === '/groups').map(() => s.title),
    );
    expect(groups).toEqual(['nav.admin']);
    expect(sections.map((s) => s.title)).toEqual([
      'nav.admin',
      'nav.myJourney',
    ]);
  });

  it('shows nothing for a user with no roles', () => {
    expect(sectionsFor([])).toEqual([]);
  });
});

describe('homeFor', () => {
  it('picks the home of the strongest role', () => {
    expect(homeFor(['MENTOR', 'MODERATOR'])).toBe('/admin/users');
    expect(homeFor(['MANAGER', 'MENTOR', 'MENTEE'])).toBe('/mentor');
    expect(homeFor(['MENTEE'])).toBe('/my');
    expect(homeFor([])).toBeNull();
  });
});
