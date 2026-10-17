import { amountsHidden } from './privacy';

/** Amounts and days as the app shows them everywhere: Canadian dollars, and calendar days in English. */

const currencyFormatter = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const compactFormatter = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** What every amount reads in privacy mode: the same length whatever the amount, so its size doesn't show either. */
export const HIDDEN_AMOUNT = '$•••••';

/** "$1,234.56", "-$5.00"; "$•••••" in privacy mode. */
export function formatCurrency(value: number): string {
  // Less than half a cent is zero: a sum that left -2.7e-17 behind is "$0.00", not "-$0.00".
  if (Math.abs(value) < 0.005) value = 0;
  if (amountsHidden()) return value < 0 ? `-${HIDDEN_AMOUNT}` : HIDDEN_AMOUNT;
  return currencyFormatter.format(value);
}

/** "$5K", "$1.2K": for axis ticks, which carry the values that aren't labelled. Blank in privacy mode. */
export function formatCompactCurrency(value: number): string {
  return amountsHidden() ? '' : compactFormatter.format(value);
}

/**
 * A calendar day from the API ("2026-06-30T00:00:00Z", or just "2026-06-30") as "Jun 30, 2026", or "Jun 30" with
 * `year: false`. Read as the day it is: midnight UTC would be the day before west of Greenwich.
 */
export function formatDay(iso: string, options: { year?: boolean } = {}): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(options.year === false ? {} : { year: 'numeric' }),
  });
}
