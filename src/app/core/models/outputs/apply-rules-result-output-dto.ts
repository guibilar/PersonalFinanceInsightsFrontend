export interface ApplyRulesResultOutputDto {
  /** Transactions the rules were applied to. */
  checked: number;
  /** Transactions whose category or flow changed. */
  updated: number;
}
