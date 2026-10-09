import { Pipe, PipeTransform } from '@angular/core';
import { formatCurrency } from '../utils/format';

/**
 * An amount as the app shows it ("$1,234.56"), or hidden in privacy mode. Impure, so switching privacy mode redraws
 * the amounts already on the page: a pure pipe would only run again when the amount changed.
 */
@Pipe({ name: 'money', pure: false })
export class MoneyPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return value == null ? '' : formatCurrency(value);
  }
}
