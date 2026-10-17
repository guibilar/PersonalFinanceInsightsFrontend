import { dayHeading } from './timeline';

describe('timeline', () => {
  it('names the day, with the year only in another year', () => {
    expect(dayHeading('2026-10-10', '2026-10-10')).toBe('Today · Sat Oct 10');
    expect(dayHeading('2026-10-09', '2026-10-10')).toBe('Yesterday · Fri Oct 9');
    expect(dayHeading('2026-10-08', '2026-10-10')).toBe('Thu Oct 8');
    expect(dayHeading('2025-10-08', '2026-10-10')).toBe('Wed Oct 8, 2025');
    expect(dayHeading('2025-12-31', '2026-01-01')).toBe('Yesterday · Wed Dec 31, 2025');
  });
});
