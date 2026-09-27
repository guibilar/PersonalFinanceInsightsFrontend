import {
  averageCaption,
  budgetsOverLimit,
  categoryShares,
  finishedMonths,
  monthIndex,
  percentChange,
  previousMonthToDateLabel,
  spentThisMonth,
} from './dashboard-stats';
import { CategorizedReportOutputDto } from '../../core/models/outputs/categorized-report-output-dto';
import { BudgetOutputDto } from '../../core/models/outputs/budget-output-dto';

function report(
  months: { month: string; values: Record<string, number> }[],
): CategorizedReportOutputDto {
  return {
    categories: [],
    averageMonthlyTotal: 0,
    monthlyData: months.map(({ month, values }) => ({
      month,
      categoryValues: values,
      total: Object.values(values).reduce((a, b) => a + b, 0),
    })),
  };
}

describe('dashboard stats', () => {
  it('reads this month total, or 0 without data', () => {
    expect(spentThisMonth(report([{ month: 'Sep 2026', values: { Dining: 10, Rent: 90 } }]))).toBe(
      100,
    );
    expect(spentThisMonth(report([]))).toBe(0);
  });

  it('names the part of last month that this month is compared with', () => {
    expect(previousMonthToDateLabel(new Date(2026, 8, 5))).toBe('Aug 1–5');
    expect(previousMonthToDateLabel(new Date(2026, 8, 1))).toBe('Aug 1');
    // February is shorter: on March 30th it is all of it.
    expect(previousMonthToDateLabel(new Date(2026, 2, 30))).toBe('Feb 1–28');
    // Across the year boundary.
    expect(previousMonthToDateLabel(new Date(2027, 0, 12))).toBe('Dec 1–12');
    // Late on the last day of September is still September here, whatever the date is in UTC.
    expect(previousMonthToDateLabel(new Date(2026, 8, 30, 23, 30))).toBe('Aug 1–30');
  });

  it('reads report month labels', () => {
    expect(monthIndex('Sep 2026')).toBe(2026 * 12 + 8);
    expect(monthIndex('Jan 2027')! - monthIndex('Dec 2026')!).toBe(1);
    expect(monthIndex('Sept 2026')).toBeNull();
    expect(monthIndex('Sep')).toBeNull();
  });

  it('says which months the average covers', () => {
    const now = new Date(2026, 8, 15);

    expect(averageCaption(['Jul 2026', 'Aug 2026', 'Sep 2026'], now)).toBe(
      'Over 2 finished months',
    );
    expect(averageCaption(['Aug 2026', 'Sep 2026'], now)).toBe('Over 1 finished month');
    expect(averageCaption(['Sep 2026'], now)).toBe('This month so far');
    expect(averageCaption([], now)).toBe('No spending yet');
  });

  it('averages only months that are over, or every month in the first one', () => {
    const labels = ['Jul 2026', 'Aug 2026', 'Sep 2026', 'Oct 2026'];

    expect(finishedMonths(labels, new Date(2026, 8, 15))).toEqual([0, 1]);
    expect(finishedMonths(['Jan 2026'], new Date(2026, 0, 20))).toEqual([0]);
    expect(finishedMonths([], new Date(2026, 0, 20))).toEqual([]);
  });

  it('computes the change, or null without a baseline', () => {
    expect(percentChange(120, 100)).toBeCloseTo(20);
    expect(percentChange(50, 100)).toBeCloseTo(-50);
    expect(percentChange(50, null)).toBeNull();
    expect(percentChange(50, 0)).toBeNull();
  });

  it('ranks categories by amount with their share', () => {
    const shares = categoryShares(
      report([{ month: 'Sep 2026', values: { Dining: 25, Rent: 75, Pet: 0 } }]),
    );

    expect(shares.map((s) => [s.category, s.percent])).toEqual([
      ['Rent', 75],
      ['Dining', 25],
    ]);
  });

  it('counts budgets at or over their limit', () => {
    const budgets = [50, 100, 130].map((percentageUsed) => ({ percentageUsed }) as BudgetOutputDto);

    expect(budgetsOverLimit(budgets)).toBe(2);
  });
});
