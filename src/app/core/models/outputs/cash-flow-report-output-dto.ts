export interface CashFlowMonthDto {
  /** "Jan 2026". */
  month: string;
  /** Money in that counts as income: not transfers, refunds or ignored rows. */
  income: number;
  /** Spending minus refunds. */
  spending: number;
  /** What was left over: income minus spending. Negative when more went out than came in. */
  net: number;
  /**
   * How the savings accounts changed: moved into them minus moved out of them, interest included. 0 when nothing
   * is recorded on a savings account, which is not the same as nothing being saved.
   */
  savingsChange: number;
}

/** Money in and out per month of the current year, for the months that have anything that counts. */
export interface CashFlowReportOutputDto {
  months: CashFlowMonthDto[];
  /** Averages over the finished months, or over every month while none is finished yet. */
  averageMonthlyIncome: number;
  averageMonthlySpending: number;
  /** Income minus spending, per month. */
  averageMonthlyNet: number;
  averageMonthlySavingsChange: number;
  /** How many months the averages are over. */
  averagedMonths: number;
  /** True when no month is over yet, so the averages are over the running one. */
  averagesIncludeCurrentMonth: boolean;
}
