import {
  budgetsOverLimit,
  categoryShares,
  monthLabel,
  percentChange,
  previousMonthTotal,
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
  it('formats months like the API', () => {
    expect(monthLabel(new Date(Date.UTC(2026, 8, 27)))).toBe('Sep 2026');
  });

  it('reads this month total, or 0 without data', () => {
    expect(spentThisMonth(report([{ month: 'Sep 2026', values: { Dining: 10, Rent: 90 } }]))).toBe(
      100,
    );
    expect(spentThisMonth(report([]))).toBe(0);
  });

  it('finds the previous calendar month, including gaps and January', () => {
    const year = report([
      { month: 'Jul 2026', values: { Dining: 50 } },
      { month: 'Aug 2026', values: { Dining: 80 } },
      { month: 'Sep 2026', values: { Dining: 100 } },
    ]);

    expect(previousMonthTotal(year, new Date(Date.UTC(2026, 8, 15)))).toBe(80);
    expect(previousMonthTotal(year, new Date(Date.UTC(2026, 0, 15)))).toBeNull();
    expect(
      previousMonthTotal(
        report([{ month: 'Jul 2026', values: { Dining: 5 } }]),
        new Date(Date.UTC(2026, 8, 1)),
      ),
    ).toBeNull();
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
