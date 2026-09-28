export interface CashFlowMonthDto {
  /** "Jan 2026". */
  month: string;
  income: number;
  spending: number;
  /** Income minus spending. */
  net: number;
  /** Moved into savings accounts minus moved out of them. */
  saved: number;
}

/** Money in and out per month of the current year, for the months that have any data. */
export interface CashFlowReportOutputDto {
  months: CashFlowMonthDto[];
  /** Averages over the finished months, or over every month while none is finished yet. */
  averageMonthlyIncome: number;
  averageMonthlySpending: number;
  averageMonthlySaved: number;
}
