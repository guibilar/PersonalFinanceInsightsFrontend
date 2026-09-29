import { Status } from '../enums/status';
import { BudgetPeriod } from '../enums/budget-period';
import { CategoryReference } from './category-output-dto';

export interface BudgetOutputDto {
  id: string;
  name: string;
  description: string;
  status: Status;
  period: BudgetPeriod;
  /** Custom periods only: the first day that counts, `yyyy-MM-dd…`. */
  startDate?: string | null;
  /** Custom periods only: the last day that counts, `yyyy-MM-dd…`. */
  endDate?: string | null;
  /** Counted by itself (any period but Total): spending whose description contains it, ignoring case. */
  merchant?: string | null;
  /** Counted by themselves (any period but Total): the period's spending in them, with no linking. */
  categories: CategoryReference[];
  totalAmount: number;
  totalSpent: number;
  totalRemaining: number;
  percentageUsed: number;
}
