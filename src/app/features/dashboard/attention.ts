import { BudgetOutputDto } from '../../core/models/outputs/budget-output-dto';
import { RecurringReportDto } from '../../core/models/outputs/insights-output-dto';
import { AccountOutputDto } from '../../core/models/outputs/account-output-dto';
import { StatementFormat } from '../../core/models/enums/statement-format';
import { formatCurrency, formatDay } from '../../shared/utils/format';

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
      link: '/money/budgets',
    });
  }
  const last = lastImportDay(inputs.accounts);
  if (last) {
    const days = Math.round((startOfDay(today) - last.getTime()) / DAY_MS);
    if (days > IMPORT_REMINDER_DAYS) {
      items.push({
        kind: 'statement',
        text: `No statements imported in ${days} days`,
        link: '/money/transactions',
      });
    }
  }
  for (const account of accountsBehind(inputs.accounts, today)) {
    items.push({
      kind: 'statement',
      text: `${account.name}: statements reach ${formatDay(statementsReach(account)!)}. Import last month's`,
      link: '/money/transactions',
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
      link: '/money/subscriptions',
    });
  }
  if (inputs.unsorted > 0) {
    items.push({
      kind: 'unsorted',
      text: `${inputs.unsorted} ${inputs.unsorted === 1 ? 'transaction is' : 'transactions are'} in Other because no rule names ${inputs.unsorted === 1 ? 'its merchant' : 'their merchants'}`,
      link: '/money/rules',
      fragment: 'unsorted',
    });
  }
  return items;
}
