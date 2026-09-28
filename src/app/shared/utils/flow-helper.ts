import { Flow } from '../../core/models/enums/flow';
import { TransactionType } from '../../core/models/enums/transaction-type';

export const FLOW_LABELS: Record<Flow, string> = {
  [Flow.Spending]: 'Spending',
  [Flow.Refund]: 'Refund',
  [Flow.Income]: 'Income',
  [Flow.Transfer]: 'Transfer',
  [Flow.Ignored]: 'Ignored',
};

/** One line on what each flow does to the reports, for hints next to a flow choice. */
export const FLOW_DESCRIPTIONS: Record<Flow, string> = {
  [Flow.Spending]: 'Counts as spending.',
  [Flow.Refund]: 'Money back: takes it off your spending.',
  [Flow.Income]: 'Counts as income.',
  [Flow.Transfer]: 'Between your own accounts, like a card payment: neither spending nor income.',
  [Flow.Ignored]: 'Left out of the reports, like a pending hold.',
};

// The API refuses any other combination.
const FLOWS_BY_DIRECTION: Record<TransactionType, Flow[]> = {
  [TransactionType.Debit]: [Flow.Spending, Flow.Transfer, Flow.Ignored],
  [TransactionType.Credit]: [Flow.Refund, Flow.Income, Flow.Transfer, Flow.Ignored],
};

/** The flows a transaction can have: money out (Debit) can't be income, money in (Credit) can't be spending. */
export function flowsFor(direction: TransactionType | undefined): Flow[] {
  return direction ? FLOWS_BY_DIRECTION[direction] : Object.values(Flow);
}

/** A flow rule can set anything but Spending, which money out already is without a rule. */
export const FLOW_RULE_FLOWS: Flow[] = [Flow.Refund, Flow.Income, Flow.Transfer, Flow.Ignored];
