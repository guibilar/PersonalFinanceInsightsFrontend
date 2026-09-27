export interface CategoryRulesResultOutputDto {
  /** Transactions the rules were applied to (hand-picked categories, savings and fixed rent are skipped). */
  checked: number;
  updated: number;
}
