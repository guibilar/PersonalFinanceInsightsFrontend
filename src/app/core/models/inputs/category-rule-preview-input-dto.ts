import { Category } from '../enums/category';

export interface CategoryRulePreviewInputDto {
  keyword: string;
  category: Category;
  /** Left out of the count, e.g. the transaction being edited. */
  excludeTransactionId?: string;
}
