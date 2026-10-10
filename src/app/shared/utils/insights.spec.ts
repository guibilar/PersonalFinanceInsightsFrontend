import { changeText, shortDay, stepReview } from './insights';

describe('insights', () => {
  it('says how much an amount changed, as people say it', () => {
    expect(changeText(110, 100)).toEqual({ text: '10% more', up: true });
    expect(changeText(80, 100)).toEqual({ text: '20% less', up: false });
    expect(changeText(100.5, 100)).toEqual({ text: 'about the same', up: false });
    expect(changeText(50, 0)).toBeNull();
  });

  it('reads an API day as that day, whatever the time zone', () => {
    expect(shortDay('2026-10-20T00:00:00Z')).toBe('Oct 20');
  });

  describe('stepping between reviews', () => {
    const today = new Date(2026, 9, 4);

    it('moves a month at a time, across years', () => {
      expect(stepReview(2026, 1, -1, today, '2025-03')).toEqual({ year: 2025, month: 12 });
      expect(stepReview(2026, 8, 1, today, null)).toEqual({ year: 2026, month: 9 });
    });

    it('stops at the running month and at the first month with data', () => {
      expect(stepReview(2026, 10, 1, today, null)).toBeNull();
      expect(stepReview(2025, 3, -1, today, '2025-03')).toBeNull();
    });

    it('stops at 2000 when there is no data to stop at', () => {
      expect(stepReview(2000, 1, -1, today, null)).toBeNull();
      expect(stepReview(2000, null, -1, today, null)).toBeNull();
      expect(stepReview(2000, 2, -1, today, null)).toEqual({ year: 2000, month: 1 });
    });

    it('moves a year at a time, a year with any data being there', () => {
      expect(stepReview(2026, null, -1, today, '2025-11')).toEqual({ year: 2025, month: null });
      expect(stepReview(2025, null, -1, today, '2025-11')).toBeNull();
      expect(stepReview(2026, null, 1, today, null)).toBeNull();
    });
  });
});
