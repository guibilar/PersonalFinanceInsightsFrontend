import { BudgetOutputDto } from '../../core/models/outputs/budget-output-dto';
import { CategorizedReportOutputDto } from '../../core/models/outputs/categorized-report-output-dto';

export interface CategoryShare {
  category: string;
  amount: number;
  /** Share of the month's total, 0–100. */
  percent: number;
}

/**
 * Month label in the API's format ("MMM yyyy", invariant culture), e.g. "Sep 2026", for the date's local
 * calendar month. Local, like the API's reporting time zone: in UTC the evening of the last day of a month
 * is already the next month.
 */
export function monthLabel(date: Date): string {
  return `${date.toLocaleString('en-US', { month: 'short' })} ${date.getFullYear()}`;
}

export function spentThisMonth(currentMonth: CategorizedReportOutputDto): number {
  return currentMonth.monthlyData[0]?.total ?? 0;
}

/** Total of the calendar month before `now`, or null when the report doesn't cover it (e.g. in January). */
export function previousMonthTotal(
  yearReport: CategorizedReportOutputDto,
  now: Date,
): number | null {
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const month = yearReport.monthlyData.find((m) => m.month === monthLabel(previous));
  return month ? month.total : null;
}

/** Percentage change from `previous` to `current`, or null when there is nothing to compare with. */
export function percentChange(current: number, previous: number | null): number | null {
  if (previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/** Categories of the month, largest first, with their share of the total. */
export function categoryShares(currentMonth: CategorizedReportOutputDto): CategoryShare[] {
  const values = currentMonth.monthlyData[0]?.categoryValues ?? {};
  const total = Object.values(values).reduce((sum, value) => sum + value, 0);
  return Object.entries(values)
    .filter(([, amount]) => amount > 0)
    .map(([category, amount]) => ({
      category,
      amount,
      percent: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function budgetsOverLimit(budgets: BudgetOutputDto[]): number {
  return budgets.filter((budget) => budget.percentageUsed >= 100).length;
}
