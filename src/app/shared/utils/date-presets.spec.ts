import {
  DATE_PRESETS,
  describeRange,
  isoDay,
  matchDatePreset,
  yearStillTyped,
} from './date-presets';

describe('date presets', () => {
  // Late on September 15th: the day must not slip to UTC's.
  const today = new Date(2026, 8, 15, 23, 30);
  const range = (id: string) => DATE_PRESETS.find((p) => p.id === id)!.range(today);

  it('covers whole months before the running one, which stays open to today', () => {
    expect(DATE_PRESETS.map((p) => [p.label, p.range(today)])).toEqual([
      ['This month', { startDate: '2026-09-01' }],
      ['Last month', { startDate: '2026-08-01', endDate: '2026-08-31' }],
      ['Last 3 months', { startDate: '2026-06-01', endDate: '2026-08-31' }],
      ['Last 6 months', { startDate: '2026-03-01', endDate: '2026-08-31' }],
      ['Last 12 months', { startDate: '2025-09-01', endDate: '2026-08-31' }],
      ['This year', { startDate: '2026-01-01' }],
      ['Last year', { startDate: '2025-01-01', endDate: '2025-12-31' }],
    ]);
  });

  it('crosses into the previous year in January', () => {
    const january = new Date(2027, 0, 10);
    expect(DATE_PRESETS.find((p) => p.id === 'lastMonth')!.range(january)).toEqual({
      startDate: '2026-12-01',
      endDate: '2026-12-31',
    });
  });

  it('recognises the dates of a preset, no dates, and anything else', () => {
    expect(matchDatePreset(range('last3Months'), today)).toBe('last3Months');
    expect(matchDatePreset({ startDate: '2026-09-01' }, today)).toBe('thisMonth');
    expect(matchDatePreset({}, today)).toBe('all');
    expect(matchDatePreset({ startDate: '2026-09-01', endDate: '2026-09-30' }, today)).toBe(
      'custom',
    );
    expect(matchDatePreset({ endDate: '2026-08-31' }, today)).toBe('custom');
  });

  it('describes the days, with the year once unless the range crosses years', () => {
    expect(describeRange(range('last3Months'))).toBe('Jun 1 – Aug 31, 2026');
    expect(describeRange(range('last12Months'))).toBe('Sep 1, 2025 – Aug 31, 2026');
    expect(describeRange(range('thisMonth'))).toBe('Sep 1 – today');
    // One day (T65).
    expect(describeRange({ startDate: '2026-10-03', endDate: '2026-10-03' })).toBe('Oct 3, 2026');
  });

  it('writes local days', () => {
    expect(isoDay(today)).toBe('2026-09-15');
  });

  it('tells a year still being typed from a whole one', () => {
    expect(
      ['0002-09-15', '0202-09-15', '2026-09-15', '', null, undefined].map(yearStillTyped),
    ).toEqual([true, true, false, false, false, false]);
  });
});
