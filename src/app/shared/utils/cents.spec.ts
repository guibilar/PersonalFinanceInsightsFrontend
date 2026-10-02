import { FormControl } from '@angular/forms';
import { cents } from './cents';

describe('cents', () => {
  const check = (value: number | null) => cents(new FormControl<number | null>(value));

  it('passes whole cents, and leaves an empty amount to required', () => {
    expect([12, 12.5, 12.34, 0.1 + 0.2, 1999.99, null].map(check)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it('fails fractions of a cent', () => {
    expect([1.005, 12.345].map(check)).toEqual([{ cents: true }, { cents: true }]);
  });
});
