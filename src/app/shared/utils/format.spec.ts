import { HIDDEN_AMOUNT, formatCompactCurrency, formatCurrency, formatDay } from './format';
import { PRIVACY_STORAGE_KEY, setAmountsHidden } from './privacy';

describe('format', () => {
  it('shows amounts in Canadian dollars', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
    expect(formatCurrency(-5)).toBe('-$5.00');
    expect(formatCompactCurrency(1200)).toBe('$1.2K');
  });

  it('shows what a sum leaves below half a cent as zero, without a minus', () => {
    expect(formatCurrency(-2.7e-17)).toBe('$0.00');
    expect(formatCurrency(-0)).toBe('$0.00');
    expect(formatCurrency(-0.004)).toBe('$0.00');
    expect(formatCurrency(-0.005)).toBe('-$0.01');
    setAmountsHidden(true);
    try {
      expect(formatCurrency(-2.7e-17)).toBe(HIDDEN_AMOUNT);
    } finally {
      setAmountsHidden(false);
      localStorage.removeItem(PRIVACY_STORAGE_KEY);
    }
  });

  it('hides every amount in privacy mode, at the same length whatever its size, and remembers it', () => {
    setAmountsHidden(true);
    try {
      expect(formatCurrency(1234.5)).toBe(HIDDEN_AMOUNT);
      expect(formatCurrency(5)).toBe(HIDDEN_AMOUNT);
      expect(formatCurrency(-5)).toBe(`-${HIDDEN_AMOUNT}`);
      expect(formatCompactCurrency(1200)).toBe('');
      expect(localStorage.getItem(PRIVACY_STORAGE_KEY)).toBe('true');
    } finally {
      setAmountsHidden(false);
      localStorage.removeItem(PRIVACY_STORAGE_KEY);
    }
    expect(formatCurrency(5)).toBe('$5.00');
  });

  it('shows an API day as the day it is, with or without the year', () => {
    expect(formatDay('2026-06-30T00:00:00Z')).toBe('Jun 30, 2026');
    expect(formatDay('2026-06-30')).toBe('Jun 30, 2026');
    expect(formatDay('2026-10-20T00:00:00Z', { year: false })).toBe('Oct 20');
  });
});
