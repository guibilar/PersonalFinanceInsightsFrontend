import { BudgetPeriod } from '../../core/models/enums/budget-period';
import { periodName, periodSuffix } from './budget-period';

describe('budget period labels', () => {
  const days = { startDate: '2026-07-01T00:00:00Z', endDate: '2026-08-15T00:00:00Z' };

  it('names every period but total, and says when it is', () => {
    const labels = [
      BudgetPeriod.Total,
      BudgetPeriod.Monthly,
      BudgetPeriod.Yearly,
      BudgetPeriod.Custom,
    ].map((period) => [periodName({ period, ...days }), periodSuffix({ period, ...days })]);

    expect(labels).toEqual([
      [null, ''],
      ['Monthly', ' this month'],
      ['Yearly', ' this year'],
      ['Custom', ' · Jul 1 – Aug 15, 2026'],
    ]);
  });

  it('leaves a custom budget without days unexplained', () => {
    expect(periodSuffix({ period: BudgetPeriod.Custom })).toBe('');
  });
});
