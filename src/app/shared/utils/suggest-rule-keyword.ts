import { TEXT_LIMITS } from '../../core/models/text-limits';

// Card processors put their own name before the merchant's: "SQ *CORNER STORE", "TST-PIZZA PLACE".
const PROCESSOR_PREFIX = /^(SQ\s*\*|TST\s*[-*]|PAYPAL\s*\*|PP\s*\*|SP\s+)\s*/;

/**
 * A merchant keyword for a category rule, guessed from a bank description: the processor prefix
 * dropped, then the leading words up to the first one with a digit or '#' (store numbers, dates,
 * references), upper-case. "SQ *CORNER STORE #123 TORONTO ON" gives "CORNER STORE". Falls back to
 * the whole description when nothing is left.
 */
export function suggestRuleKeyword(description: string): string {
  const upper = description.trim().toUpperCase();
  const words = upper.replace(PROCESSOR_PREFIX, '').split(/\s+/);
  const end = words.findIndex((word) => /[\d#]/.test(word));
  const keyword = (end === -1 ? words : words.slice(0, end)).join(' ').trim();
  return (keyword || upper).slice(0, TEXT_LIMITS.categoryRuleKeyword).trim();
}
