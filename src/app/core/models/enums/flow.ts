/**
 * What a transaction means for the reports. Money out can be Spending, Transfer or Ignored; money in can
 * be Refund, Income, Transfer or Ignored (see flowsFor in shared/utils/flow-labels).
 */
export enum Flow {
  /** Counts as spending (money out only). */
  Spending = 'Spending',
  /** Money back: reduces spending (money in only). */
  Refund = 'Refund',
  /** Counts as income (money in only). */
  Income = 'Income',
  /** Between your own accounts (a card payment, moving money to savings): neither spending nor income. */
  Transfer = 'Transfer',
  /** Not counted at all (pending holds, anything left out on purpose). */
  Ignored = 'Ignored',
}
