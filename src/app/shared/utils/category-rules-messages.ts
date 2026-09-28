import { CategoryRulesResultOutputDto } from '../../core/models/outputs/category-rules-result-output-dto';

/** Shown before re-applying the category rules to stored transactions. */
export const APPLY_RULES_CONFIRMATION =
  'Every transaction is re-categorised with the current rules. Categories you picked by hand and savings transactions are left as they are.';

export function describeRulesResult({ checked, updated }: CategoryRulesResultOutputDto): string {
  return updated === 0
    ? `All ${checked} categories already match the rules`
    : `Recategorised ${updated} of ${checked} transactions`;
}
