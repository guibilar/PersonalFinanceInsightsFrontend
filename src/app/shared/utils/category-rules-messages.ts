import { ApplyRulesResultOutputDto } from '../../core/models/outputs/apply-rules-result-output-dto';

/** Shown before re-applying the category and flow rules to stored transactions. */
export const APPLY_RULES_CONFIRMATION =
  'Every transaction gets its category and flow from the current rules again. Categories and flows you picked by hand, and the categories of savings transactions, are left as they are.';

export function describeRulesResult({ checked, updated }: ApplyRulesResultOutputDto): string {
  return updated === 0
    ? `All ${checked} transactions already match the rules`
    : `Updated ${updated} of ${checked} transactions`;
}
