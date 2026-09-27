import { BudgetOutputDto } from '../../core/models/outputs/budget-output-dto';
import { CategorizedReportOutputDto } from '../../core/models/outputs/categorized-report-output-dto';

export interface CategoryShare {
  category: string;
  amount: number;
  /** Share of the month's total, 0–100. */
  percent: number;
}

export function spentThisMonth(currentMonth: CategorizedReportOutputDto): number {
  return currentMonth.monthlyData[0]?.total ?? 0;
}

/**
 * The part of last month that the API compares this month with: day 1 up to today's day of the month, or the
 * whole month when it is shorter. "Aug 1–5" on September 5th, "Feb 1–28" on March 30th.
 */
export function previousMonthToDateLabel(now: Date): string {
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const daysInPrevious = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  const lastDay = Math.min(now.getDate(), daysInPrevious);
  const month = previous.toLocaleString('en-US', { month: 'short' });
  return lastDay === 1 ? `${month} 1` : `${month} 1–${lastDay}`;
}

/**
 * Index of the month a report label ("Sep 2026") stands for, counting months since year 0, so labels and
 * dates compare as numbers; null for a label in another format.
 */
export function monthIndex(label: string): number | null {
  const [name, year] = label.split(' ');
  const month = MONTH_NAMES.indexOf(name);
  return month >= 0 && /^\d{4}$/.test(year ?? '') ? Number(year) * 12 + month : null;
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** What the monthly average is taken over, in the same terms as {@link finishedMonths}. */
export function averageCaption(labels: string[], now: Date): string {
  const current = now.getFullYear() * 12 + now.getMonth();
  const finished = labels.filter((label) => (monthIndex(label) ?? current) < current).length;
  if (finished > 0) return `Over ${finished} finished month${finished === 1 ? '' : 's'}`;
  return labels.length > 0 ? 'This month so far' : 'No spending yet';
}

/**
 * Positions of the months that are over, to average: the running month would pull the average down (and
 * future-dated rows don't belong in it either). When no month is over yet (January), all of them.
 */
export function finishedMonths(labels: string[], now: Date): number[] {
  const current = now.getFullYear() * 12 + now.getMonth();
  const finished = labels.flatMap((label, index) => {
    const month = monthIndex(label);
    return month !== null && month < current ? [index] : [];
  });
  return finished.length > 0 ? finished : labels.map((_, index) => index);
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
