import { TodayValue } from '../../core/models/outputs/today-output-dto';
import { formatCurrency, formatDay } from '../../shared/utils/format';

const countFormatter = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 0 });
const percentFormatter = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 1 });

/**
 * One Today value as the app shows it: amounts as "$1,234.56" ("$•••••" in privacy mode), days as "Jun 30, 2026",
 * counts and percentages in the app's number format. The server sends the raw values (T08), so each client keeps
 * its own formats and its privacy mode.
 */
export function formatTodayValue(value: TodayValue): string {
  switch (value.type) {
    case 'Money':
      return formatCurrency(value.number ?? 0);
    case 'Count':
      return countFormatter.format(value.number ?? 0);
    case 'Percent':
      return `${percentFormatter.format(value.number ?? 0)}%`;
    case 'Date':
      return value.date ? formatDay(value.date) : '';
    case 'Text':
      return value.text ?? '';
    default:
      // A value type that a newer server sends: its text, if it has one.
      return value.text ?? '';
  }
}

const PLACEHOLDER = /\{([A-Za-z0-9_-]+)\}/g;

/**
 * A card text with each `{name}` placeholder filled from `values`. A placeholder without a value stays as it is, so
 * a contract mistake is visible and not a silent gap. Null text gives an empty string.
 */
export function fillTodayText(
  text: string | null | undefined,
  values: Record<string, TodayValue> | null | undefined,
): string {
  if (!text) return '';
  return text.replace(PLACEHOLDER, (placeholder, name: string) => {
    // Its own values only: `{constructor}` is not a value of every object.
    const value = values && Object.hasOwn(values, name) ? values[name] : undefined;
    return value ? formatTodayValue(value) : placeholder;
  });
}
