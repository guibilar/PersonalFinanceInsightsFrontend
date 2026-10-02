/** A date filter as the transactions API takes it: inclusive ISO days, either end left open. */
export interface DateRange {
  startDate?: string;
  endDate?: string;
}

export type DatePresetId =
  | 'thisMonth'
  | 'lastMonth'
  | 'last3Months'
  | 'last6Months'
  | 'last12Months'
  | 'thisYear'
  | 'lastYear';

export interface DatePreset {
  id: DatePresetId;
  label: string;
  /** The days it covers on a given day. The running month and year stay open-ended, so they run to today. */
  range(today: Date): DateRange;
}

/** An ISO day ("2026-09-01") in local time, as date inputs and the API use them. */
export function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The last `count` whole months before the running one, so none of them is cut short. */
function wholeMonths(count: number): (today: Date) => DateRange {
  return (today) => ({
    startDate: isoDay(new Date(today.getFullYear(), today.getMonth() - count, 1)),
    endDate: isoDay(new Date(today.getFullYear(), today.getMonth(), 0)),
  });
}

export const DATE_PRESETS: readonly DatePreset[] = [
  {
    id: 'thisMonth',
    label: 'This month',
    range: (today) => ({ startDate: isoDay(new Date(today.getFullYear(), today.getMonth(), 1)) }),
  },
  { id: 'lastMonth', label: 'Last month', range: wholeMonths(1) },
  { id: 'last3Months', label: 'Last 3 months', range: wholeMonths(3) },
  { id: 'last6Months', label: 'Last 6 months', range: wholeMonths(6) },
  { id: 'last12Months', label: 'Last 12 months', range: wholeMonths(12) },
  {
    id: 'thisYear',
    label: 'This year',
    range: (today) => ({ startDate: `${today.getFullYear()}-01-01` }),
  },
  {
    id: 'lastYear',
    label: 'Last year',
    range: (today) => {
      const year = today.getFullYear() - 1;
      return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
    },
  },
];

/** The preset these dates are on the given day, "all" without dates, or "custom" for any other range. */
export function matchDatePreset(range: DateRange, today: Date): DatePresetId | 'all' | 'custom' {
  if (!range.startDate && !range.endDate) return 'all';
  const preset = DATE_PRESETS.find((p) => {
    const presetRange = p.range(today);
    return presetRange.startDate === range.startDate && presetRange.endDate === range.endDate;
  });
  return preset?.id ?? 'custom';
}

/** The days a preset covers, for its option: "Jun 1 – Aug 31, 2026", "Sep 1 – today". */
export function describeRange(range: DateRange): string {
  const day = (iso: string, withYear: boolean) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      ...(withYear ? { year: 'numeric' } : {}),
    });
  if (!range.startDate) return '';
  if (!range.endDate) return `${day(range.startDate, false)} – today`;
  const sameYear = range.startDate.slice(0, 4) === range.endDate.slice(0, 4);
  return `${day(range.startDate, !sameYear)} – ${day(range.endDate, true)}`;
}

/**
 * A day whose year is still being typed. A date field takes its year digit by digit, so on the way to 2026 its value
 * is 0002-…, 0020-… and 0202-…: real days, but not the one meant. No transaction is that old.
 */
export function yearStillTyped(day: string | null | undefined): boolean {
  return !!day && Number(day.slice(0, 4)) < 1900;
}
