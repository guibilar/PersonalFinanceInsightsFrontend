/** Which transactions count towards a budget's spending, by their date. */
export enum BudgetPeriod {
  /** Everything linked (a trip, a project). */
  Total = 'Total',
  /** Only transactions dated in the current month; starts over every month. */
  Monthly = 'Monthly',
  /** Only transactions dated in the current calendar year; starts over every year. */
  Yearly = 'Yearly',
  /** Only transactions dated from the budget's start date to its end date, both included. */
  Custom = 'Custom',
}
