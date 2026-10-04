import { Flow } from '../enums/flow';

/** One change for many transactions: only what is set changes. */
export interface TransactionBulkUpdateInputDto {
  transactionIds: string[];
  categoryId?: string;
  flow?: Flow;
  /** Links them to this active budget, moving any linked to another. */
  budgetId?: string;
  unlinkBudget?: boolean;
  addTagId?: string;
  removeTagId?: string;
}

export interface BulkUpdateResultDto {
  updated: number;
  skipped: number;
  /** Why some were skipped. */
  notes: string[];
}
