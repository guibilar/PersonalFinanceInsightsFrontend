import { ParamMap, Params } from '@angular/router';
import { Flow } from '../../../core/models/enums/flow';
import { BreakdownInterval } from '../../../core/models/outputs/transaction-breakdown-output-dto';
import { TransactionCriteria } from '../transaction-toolbar/transaction-toolbar.component';

/** The next interval down, for looking inside a period. */
export const CLOSER: Record<BreakdownInterval, BreakdownInterval> = {
  Year: 'Month',
  Quarter: 'Month',
  Month: 'Week',
  Week: 'Week',
};

const CRITERIA_KEYS = [
  'description',
  'categoryId',
  'tagId',
  'accountId',
  'flow',
  'startDate',
  'endDate',
] as const;

/** The criteria a link can open the list with: ?categoryId=…&tagId=…&description=…&startDate=…&endDate=…&accountId=… */
export function criteriaFromQuery(query: ParamMap): TransactionCriteria {
  const criteria: TransactionCriteria = {};
  for (const key of CRITERIA_KEYS) {
    const value = query.get(key);
    if (!value) continue;
    if (key === 'flow') {
      if (Object.values(Flow).includes(value as Flow)) criteria.flow = value as Flow;
    } else {
      criteria[key] = value;
    }
  }
  return criteria;
}

/** The criteria that are set, as a query string would carry them. */
export function definedCriteria(criteria: TransactionCriteria): Record<string, string> {
  const defined: Record<string, string> = {};
  for (const key of CRITERIA_KEYS) {
    const value = criteria[key];
    if (value) defined[key] = value;
  }
  return defined;
}

export function sameCriteria(a: TransactionCriteria, b: TransactionCriteria): boolean {
  return JSON.stringify(definedCriteria(a)) === JSON.stringify(definedCriteria(b));
}

export function intervalFromQuery(query: ParamMap): BreakdownInterval | null {
  const value = query.get('interval');
  return value && value in CLOSER ? (value as BreakdownInterval) : null;
}

/** The query key of a link to one transaction: `/money/transactions?id=…`. */
export const TRANSACTION_ID_KEY = 'id';

/**
 * A link to one transaction. The page finds it, shows its day and account, scrolls to it and highlights it; then the
 * address keeps those criteria, not the id.
 */
export function transactionLink(id: string): { route: string; queryParams: Params } {
  return { route: '/money/transactions', queryParams: { [TRANSACTION_ID_KEY]: id } };
}

/** Marks the navigations the list makes itself to keep the address up to date, so it doesn't apply them back. */
export const OWN_NAVIGATION = 'transactionListFilters';
