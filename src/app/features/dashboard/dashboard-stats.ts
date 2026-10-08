import { finishedMonths, monthIndex, monthLabel } from '../../shared/utils/months';
import { BudgetOutputDto } from '../../core/models/outputs/budget-output-dto';
import { CategorizedReportOutputDto } from '../../core/models/outputs/categorized-report-output-dto';
import {
  CashFlowMonthDto,
  CashFlowReportOutputDto,
} from '../../core/models/outputs/cash-flow-report-output-dto';
import { NetWorthMonthDto } from '../../core/models/outputs/net-worth-output-dto';
import { RecurringReportDto } from '../../core/models/outputs/insights-output-dto';
import { AccountOutputDto } from '../../core/models/outputs/account-output-dto';
import { AccountType } from '../../core/models/enums/account-type';
import { RegisteredPlan } from '../../core/models/enums/registered-plan';
import { StatementFormat } from '../../core/models/enums/statement-format';
import { formatCurrency, formatDay } from '../../shared/utils/format';

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

/** What the monthly average is taken over, in the same terms as {@link finishedMonths}. */
export function averageCaption(labels: string[], now: Date): string {
  const current = now.getFullYear() * 12 + now.getMonth();
  const finished = labels.filter((label) => (monthIndex(label) ?? current) < current).length;
  if (finished > 0) return `Over ${finished} finished month${finished === 1 ? '' : 's'}`;
  return labels.length > 0 ? 'This month so far' : 'No spending yet';
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

/** This month's income, spending and what was left over; null before anything is recorded this month. */
export function leftOverThisMonth(
  report: CashFlowReportOutputDto,
  today: Date,
): CashFlowMonthDto | null {
  return report.months.find((m) => m.month === monthLabel(today)) ?? null;
}

/** What a usual month (its average) has cost by today, spread evenly over its days. */
export function usualByNow(monthlyAverage: number, today: Date): number {
  const days = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return (monthlyAverage * today.getDate()) / days;
}

/**
 * How net worth moved since the end of last month; null when that month isn't known, or was known for fewer
 * accounts than today (an account's history starting later would read as a jump).
 */
export function netWorthChange(months: NetWorthMonthDto[]): number | null {
  if (months.length < 2) return null;
  const [before, now] = months.slice(-2);
  return before.accountsCounted < now.accountsCounted ? null : now.netWorth - before.netWorth;
}

export type AttentionKind = 'unsorted' | 'budget' | 'price' | 'statement';

/** Something on the dashboard that needs a look, and where to deal with it. */
export interface AttentionItem {
  kind: AttentionKind;
  text: string;
  link: string;
  fragment?: string;
}

/** Price changes this recent are worth a mention. */
const PRICE_CHANGE_DAYS = 45;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The day an account's imported statements reach: its latest transaction or its latest balance (Wealthsimple
 * statements record one for their last day, even in a month without activity). Null when it has neither.
 */
export function statementsReach(account: AccountOutputDto): string | null {
  const days = [account.lastTransactionDate, account.balance?.date].filter((d): d is string => !!d);
  return days.length === 0 ? null : days.reduce((a, b) => (a > b ? a : b));
}

/**
 * Accounts whose statements stop before last month began: last month's statement is out and not imported yet.
 * Accounts added by hand, and ones nothing was ever imported into, are left alone.
 */
export function accountsBehind(accounts: AccountOutputDto[], today: Date): AccountOutputDto[] {
  const lastMonthStart = Date.UTC(today.getFullYear(), today.getMonth() - 1, 1);
  return accounts.filter((account) => {
    if (account.format === StatementFormat.Manual) return false;
    const reach = statementsReach(account);
    return reach !== null && Date.parse(reach) < lastMonthStart;
  });
}

/** More days than this without importing a statement is worth a mention (the Android app notifies too). */
export const IMPORT_REMINDER_DAYS = 7;

function startOfDay(day: Date): number {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
}

/**
 * The local day statements were last imported: the latest import into an account that takes statements, or, for
 * accounts imported into before imports were recorded, the latest transaction's day. Null when nothing ever was.
 */
export function lastImportDay(accounts: AccountOutputDto[]): Date | null {
  const importable = accounts.filter((a) => a.format !== StatementFormat.Manual);
  const imported = importable
    .map((a) => a.lastImportedAt)
    .filter((d): d is string => !!d)
    .map((d) => startOfDay(new Date(d)));
  if (imported.length > 0) return new Date(Math.max(...imported));
  // Transaction dates are calendar days at midnight UTC: the same day here.
  const transactions = importable
    .map((a) => a.lastTransactionDate)
    .filter((d): d is string => !!d)
    .map((d) => {
      const day = new Date(d);
      return new Date(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()).getTime();
    });
  return transactions.length > 0 ? new Date(Math.max(...transactions)) : null;
}

export interface AttentionInputs {
  unsorted: number;
  budgets: BudgetOutputDto[];
  recurring: RecurringReportDto | null;
  accounts: AccountOutputDto[];
}

/** What needs a look, most pressing first; empty when all is well. */
export function attentionItems(inputs: AttentionInputs, today: Date): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const budget of inputs.budgets.filter((b) => b.percentageUsed >= 100)) {
    items.push({
      kind: 'budget',
      text: `${budget.name} is over its limit (${Math.round(budget.percentageUsed)}% used)`,
      link: '/budgets',
    });
  }
  const last = lastImportDay(inputs.accounts);
  if (last) {
    const days = Math.round((startOfDay(today) - last.getTime()) / DAY_MS);
    if (days > IMPORT_REMINDER_DAYS) {
      items.push({
        kind: 'statement',
        text: `No statements imported in ${days} days`,
        link: '/transactions',
      });
    }
  }
  for (const account of accountsBehind(inputs.accounts, today)) {
    items.push({
      kind: 'statement',
      text: `${account.name}: statements reach ${formatDay(statementsReach(account)!)}. Import last month's`,
      link: '/transactions',
    });
  }
  for (const payment of inputs.recurring?.payments ?? []) {
    const change = payment.priceChange;
    if (!change || payment.status === 'Stopped') continue;
    if (today.getTime() - Date.parse(change.since) > PRICE_CHANGE_DAYS * DAY_MS) continue;
    const verb = change.to > change.from ? 'went up' : 'went down';
    items.push({
      kind: 'price',
      text: `${payment.name} ${verb} from ${formatCurrency(change.from)} to ${formatCurrency(change.to)}`,
      link: '/subscriptions',
    });
  }
  if (inputs.unsorted > 0) {
    items.push({
      kind: 'unsorted',
      text: `${inputs.unsorted} ${inputs.unsorted === 1 ? 'transaction is' : 'transactions are'} in Other because no rule names ${inputs.unsorted === 1 ? 'its merchant' : 'their merchants'}`,
      link: '/rules',
      fragment: 'unsorted',
    });
  }
  return items;
}

/** An investment or registered account on the dashboard: what it holds, and its plan's room this year. */
export interface InvestmentRow {
  id: string;
  name: string;
  plan: RegisteredPlan;
  balance: number | null;
  balanceDate: string | null;
  depositedThisYear: number;
  roomLeft: number | null;
}

/** Investment accounts, and savings held in a registered plan, by balance. */
export function investments(accounts: AccountOutputDto[]): InvestmentRow[] {
  return accounts
    .filter(
      (a) =>
        a.type === AccountType.Investment ||
        (a.plan !== undefined && a.plan !== RegisteredPlan.None),
    )
    .map((a) => ({
      id: a.id,
      name: a.name,
      plan: a.plan ?? RegisteredPlan.None,
      balance: a.balance?.amount ?? null,
      balanceDate: a.balance?.date ?? null,
      depositedThisYear: a.depositedThisYear ?? 0,
      roomLeft: a.roomLeft ?? null,
    }))
    .sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0));
}
