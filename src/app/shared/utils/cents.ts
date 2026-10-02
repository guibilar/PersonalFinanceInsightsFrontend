import { AbstractControl, ValidationErrors } from '@angular/forms';

/** A money amount in whole cents, as the API takes it: 12.5 and 12.50 pass, 12.505 doesn't. */
export function cents(control: AbstractControl<number | null>): ValidationErrors | null {
  const value = control.value;
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  // Rounded to cents and compared within a hair, so float noise (0.1 + 0.2) doesn't fail a valid amount.
  return Math.abs(Math.round(value * 100) - value * 100) < 1e-6 ? null : { cents: true };
}
