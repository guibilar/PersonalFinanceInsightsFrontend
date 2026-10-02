import { BudgetOutputDto } from '../../core/models/outputs/budget-output-dto';
import { CategorizedReportOutputDto } from '../../core/models/outputs/categorized-report-output-dto';

export interface CategoryShare {
  category: string;
  amount: number;
  /** Share of the month's total, 0–100. */
  percent: number;
}

/** Neutral grey, for a category the report doesn't list (none should be missing). */
export const FALLBACK_CATEGORY_COLOR = '#9CA3AF';

/** Each category's colour in the report, by name, as its values are keyed. */
export function categoryColors(report: CategorizedReportOutputDto): (name: string) => string {
  const colors = new Map(report.categories.map((category) => [category.name, category.color]));
  return (name) => colors.get(name) ?? FALLBACK_CATEGORY_COLOR;
}

/**
 * Query parameters that open the transactions list on a category with its "Over time" chart: all of its history, or
 * one month of it (a report label, "Sep 2026") week by week.
 */
export function categoryLink(categoryId: string, month?: string): Record<string, string> {
  const params: Record<string, string> = { categoryId, overTime: '1' };
  const index = month ? monthIndex(month) : null;
  if (index !== null) {
    const year = Math.floor(index / 12);
    const monthNumber = (index % 12) + 1;
    const lastDay = new Date(year, monthNumber, 0).getDate();
    const pad = (n: number) => String(n).padStart(2, '0');
    params['startDate'] = `${year}-${pad(monthNumber)}-01`;
    params['endDate'] = `${year}-${pad(monthNumber)}-${pad(lastDay)}`;
    params['interval'] = 'Week';
  }
  return params;
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

/**
 * Categories of the month, largest first, with their share of what was spent in them. A category whose refunds
 * outweigh its spending (a return) is left out of the total as well as the list, or the others would add up to more
 * than 100%.
 */
export function categoryShares(currentMonth: CategorizedReportOutputDto): CategoryShare[] {
  const values = currentMonth.monthlyData[0]?.categoryValues ?? {};
  const spent = Object.entries(values).filter(([, amount]) => amount > 0);
  const total = spent.reduce((sum, [, amount]) => sum + amount, 0);
  return spent
    .map(([category, amount]) => ({
      category,
      amount,
      percent: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export interface CategoryAverage {
  category: string;
  /** Spending per finished month, in the same terms as {@link finishedMonths} (a month without any counts as 0). */
  average: number;
  /** What the running month has added so far; 0 when nothing yet. */
  thisMonth: number;
  /** This month against the average, in percent; null when the average is 0. */
  change: number | null;
}

/**
 * Each category's monthly average over the months that are over, with this month's spending next to it, largest
 * average first. Categories with neither are left out.
 */
export function categoryAverages(year: CategorizedReportOutputDto, now: Date): CategoryAverage[] {
  const months = year.monthlyData;
  const finished = finishedMonths(
    months.map((month) => month.month),
    now,
  ).map((index) => months[index]);
  const current = now.getFullYear() * 12 + now.getMonth();
  const running = months.find((month) => monthIndex(month.month) === current);

  const categories = new Set(months.flatMap((month) => Object.keys(month.categoryValues)));
  return [...categories]
    .map((category) => {
      const total = finished.reduce((sum, month) => sum + (month.categoryValues[category] ?? 0), 0);
      const average = finished.length > 0 ? total / finished.length : 0;
      const thisMonth = running?.categoryValues[category] ?? 0;
      return { category, average, thisMonth, change: percentChange(thisMonth, average) };
    })
    .filter((row) => row.average > 0 || row.thisMonth > 0)
    .sort((a, b) => b.average - a.average || b.thisMonth - a.thisMonth);
}

export function budgetsOverLimit(budgets: BudgetOutputDto[]): number {
  return budgets.filter((budget) => budget.percentageUsed >= 100).length;
}
