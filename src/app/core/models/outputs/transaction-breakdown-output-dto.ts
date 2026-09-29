/** How long each period of a breakdown is. Weeks start on Monday. */
export type BreakdownInterval = 'Week' | 'Month' | 'Quarter' | 'Year';

export interface BreakdownPeriodDto {
  /** First day, `yyyy-MM-dd…`. */
  start: string;
  /** Last day (inclusive). */
  end: string;
  /** "Sep 1" (a week's Monday), "Sep 2026", "Q3 2026", "2026". */
  label: string;
  count: number;
  spending: number;
  income: number;
  cumulativeSpending: number;
  cumulativeIncome: number;
}

export interface MerchantTotalDto {
  /** The category rule keyword that matched ("NO FRILLS" for every store), or the description. */
  name: string;
  count: number;
  spending: number;
}

/** Totals for what the transaction list's criteria pick, and how they spread over time. */
export interface TransactionBreakdownOutputDto {
  interval: BreakdownInterval;
  count: number;
  /** Spending minus refunds. */
  spending: number;
  refunds: number;
  income: number;
  /** Per period, over the finished ones (all of them when none is finished). */
  averageSpending: number;
  averageIncome: number;
  averagedPeriods: number;
  /** Oldest first, empty ones included. */
  periods: BreakdownPeriodDto[];
  /** Largest first, at most eight. */
  topMerchants: MerchantTotalDto[];
}
