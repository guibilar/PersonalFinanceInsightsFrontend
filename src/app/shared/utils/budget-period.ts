import { BudgetPeriod } from '../../core/models/enums/budget-period';
import { BudgetOutputDto } from '../../core/models/outputs/budget-output-dto';
import { describeRange } from './date-presets';

type Dated = Pick<BudgetOutputDto, 'period' | 'startDate' | 'endDate'>;

/** The days of a custom budget, "Jul 1 – Aug 15, 2026". */
function customRange({ startDate, endDate }: Dated): string {
  return startDate && endDate
    ? describeRange({ startDate: startDate.slice(0, 10), endDate: endDate.slice(0, 10) })
    : '';
}

/** What a budget's period is called on its badge; null for a total budget, which has no period to name. */
export function periodName(budget: Dated): string | null {
  switch (budget.period) {
    case BudgetPeriod.Monthly:
      return 'Monthly';
    case BudgetPeriod.Yearly:
      return 'Yearly';
    case BudgetPeriod.Custom:
      return 'Custom';
    default:
      return null;
  }
}

/** Follows "of $500.00" to say when that is: " this month", " this year", " · Jul 1 – Aug 15, 2026". */
export function periodSuffix(budget: Dated): string {
  switch (budget.period) {
    case BudgetPeriod.Monthly:
      return ' this month';
    case BudgetPeriod.Yearly:
      return ' this year';
    case BudgetPeriod.Custom: {
      const range = customRange(budget);
      return range ? ` · ${range}` : '';
    }
    default:
      return '';
  }
}
