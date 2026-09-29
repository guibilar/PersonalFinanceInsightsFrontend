export interface CategoryRulePreviewInputDto {
  keyword: string;
  categoryId: string;
  /** Left out of the count, e.g. the transaction being edited. */
  excludeTransactionId?: string;
}
