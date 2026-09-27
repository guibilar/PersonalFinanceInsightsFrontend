/** Which linked transactions count towards a budget's spending. */
export enum BudgetPeriod {
  /** Everything linked (a trip, a project). */
  Total = 'Total',
  /** Only transactions dated in the current month; starts over every month. */
  Monthly = 'Monthly',
}
