import { formatCompactCurrency, formatCurrency, formatDay } from './format';

describe('format', () => {
  it('shows amounts in Canadian dollars', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
    expect(formatCurrency(-5)).toBe('-$5.00');
    expect(formatCompactCurrency(1200)).toBe('$1.2K');
  });

  it('shows an API day as the day it is, with or without the year', () => {
    expect(formatDay('2026-06-30T00:00:00Z')).toBe('Jun 30, 2026');
    expect(formatDay('2026-06-30')).toBe('Jun 30, 2026');
    expect(formatDay('2026-10-20T00:00:00Z', { year: false })).toBe('Oct 20');
  });
});
