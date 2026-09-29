/** A category as transactions, rules, budgets and reports show it: enough to display it without looking it up. */
export interface CategoryReference {
  id: string;
  name: string;
  /** "#RRGGBB". */
  color: string;
}

export interface CategoryOutputDto extends CategoryReference {
  /** Deleted (hidden) ones included: deleting the category moves them too. */
  transactionCount: number;
  ruleCount: number;
  /** Other, whatever it is called now: where unmatched transactions go, and a deleted category's by default. */
  isFallback: boolean;
  /** Set for the categories the app relies on (Other and Rent): why it can't be deleted. */
  builtInReason: string | null;
}
