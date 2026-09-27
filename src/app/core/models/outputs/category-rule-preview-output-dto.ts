export interface CategoryRulePreviewOutputDto {
  /** Transactions whose category would change if the rule were added first and the rules re-applied. */
  count: number;
  /** Up to five of their descriptions. */
  examples: string[];
}
