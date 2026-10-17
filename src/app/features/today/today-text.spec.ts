import { fillTodayText, formatTodayValue } from './today-text';
import { setAmountsHidden } from '../../shared/utils/privacy';
import { HIDDEN_AMOUNT } from '../../shared/utils/format';

describe('Today text', () => {
  afterEach(() => setAmountsHidden(false));

  it('formats each value type', () => {
    expect(formatTodayValue({ type: 'Money', number: 1234.5 })).toBe('$1,234.50');
    expect(formatTodayValue({ type: 'Money', number: -5 })).toBe('-$5.00');
    expect(formatTodayValue({ type: 'Count', number: 1200 })).toBe('1,200');
    expect(formatTodayValue({ type: 'Percent', number: 121 })).toBe('121%');
    expect(formatTodayValue({ type: 'Percent', number: 12.5 })).toBe('12.5%');
    expect(formatTodayValue({ type: 'Date', date: '2026-06-30' })).toBe('Jun 30, 2026');
    expect(formatTodayValue({ type: 'Text', text: 'Aug 1–5' })).toBe('Aug 1–5');
  });

  it('fills each placeholder from the values', () => {
    expect(
      fillTodayText('{payment} went up from {from} to {to}', {
        payment: { type: 'Text', text: 'Netflix' },
        from: { type: 'Money', number: 16.49 },
        to: { type: 'Money', number: 18.99 },
      }),
    ).toBe('Netflix went up from $16.49 to $18.99');
    expect(
      fillTodayText('{account}: statements reach {reach}. Import last month’s', {
        account: { type: 'Text', text: 'Chequing' },
        reach: { type: 'Date', date: '2026-08-31' },
      }),
    ).toBe('Chequing: statements reach Aug 31, 2026. Import last month’s');
    expect(
      fillTodayText('{change} more than {period}', {
        change: { type: 'Percent', number: 12 },
        period: { type: 'Text', text: 'Sep 1–13' },
      }),
    ).toBe('12% more than Sep 1–13');
  });

  it('hides amounts in privacy mode, and keeps the other values', () => {
    setAmountsHidden(true);
    expect(
      fillTodayText('−{change} since last month, {count} items', {
        change: { type: 'Money', number: 250 },
        count: { type: 'Count', number: 3 },
      }),
    ).toBe(`−${HIDDEN_AMOUNT} since last month, 3 items`);
    expect(formatTodayValue({ type: 'Money', number: 1500 })).toBe(HIDDEN_AMOUNT);
    expect(formatTodayValue({ type: 'Percent', number: 80 })).toBe('80%');
  });

  it('keeps a placeholder without a value, and gives an empty string for no text', () => {
    expect(fillTodayText('{a} and {b}', { a: { type: 'Count', number: 1 } })).toBe('1 and {b}');
    expect(fillTodayText('No income yet this month', {})).toBe('No income yet this month');
    expect(fillTodayText(null, {})).toBe('');
    expect(fillTodayText('{a}', null)).toBe('{a}');
    expect(fillTodayText('{constructor} {toString}', {})).toBe('{constructor} {toString}');
  });
});
