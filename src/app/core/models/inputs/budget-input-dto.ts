import { Status } from '../enums/status';
import { BudgetPeriod } from '../enums/budget-period';

export interface BudgetInputDto {
  id: string;
  name: string;
  description: string;
  amount: number;
  status: Status;
  period: BudgetPeriod;
  /** Custom periods only (and required for them), `yyyy-MM-dd`: the first day that counts. */
  startDate?: string;
  /** Custom periods only (and required for them), `yyyy-MM-dd`: the last day that counts. */
  endDate?: string;
  /** Any period but Total: the period's spending in these categories counts without linking. */
  categoryIds: string[];
  /** Any period but Total, and not with categories: spending whose description contains this counts without linking. */
  merchant?: string;
}
