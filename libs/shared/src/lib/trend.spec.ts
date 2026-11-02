import { planTrend } from './trend.js';

const opts = { window: 3, steadyBand: 0.05, higherIsBetter: true, target: 37 };

describe('planTrend', () => {
  it('is NEW until there are two readings to compare', () => {
    expect(planTrend([], opts).trend).toBe('NEW');
    expect(planTrend([5], opts).trend).toBe('NEW');
  });

  it('compares the latest readings with the ones before', () => {
    // Memorising surahs, design/screens/Mentee.dc.html: 8 → 22.
    const surahs = planTrend([8, 11, 13, 15, 19, 22], opts);
    expect(surahs.trend).toBe('IMPROVING');
    // (15 + 19 + 22) / 3 − (8 + 11 + 13) / 3
    expect(surahs.change).toBeCloseTo(8);
    expect(planTrend([22, 19, 15], opts).trend).toBe('WORSE');
  });

  it('calls small moves steady, relative to the plan scale', () => {
    // Fajr in congregation, 0–7 days: 4,5,5 vs 4,5,5 is no change.
    expect(planTrend([4, 5, 5, 4, 5, 5], { ...opts, target: 7 }).trend).toBe(
      'STEADY',
    );
    // +0.3 on a 37 scale is under 5%.
    expect(planTrend([10, 10.3], opts).trend).toBe('STEADY');
  });

  it('reads "down" as better when lower is better', () => {
    // Screen time self-rating 6 → 3, where less is the goal.
    const lower = { ...opts, target: 2, higherIsBetter: false };
    expect(planTrend([6, 6, 5, 5, 4, 3], lower).trend).toBe('IMPROVING');
    expect(planTrend([3, 6], lower).trend).toBe('WORSE');
  });
});
