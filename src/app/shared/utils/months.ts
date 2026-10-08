/** Report months: the API labels them "Sep 2026". */

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * Index of the month a report label ("Sep 2026") stands for, counting months since year 0, so labels and
 * dates compare as numbers; null for a label in another format.
 */
export function monthIndex(label: string): number | null {
  const [name, year] = label.split(' ');
  const month = MONTH_NAMES.indexOf(name);
  return month >= 0 && /^\d{4}$/.test(year ?? '') ? Number(year) * 12 + month : null;
}

/**
 * Positions of the months that are over, to average: the running month would pull the average down (and
 * future-dated rows don't belong in it either). When no month is over yet (January), all of them.
 */
export function finishedMonths(labels: string[], now: Date): number[] {
  const current = now.getFullYear() * 12 + now.getMonth();
  const finished = labels.flatMap((label, index) => {
    const month = monthIndex(label);
    return month !== null && month < current ? [index] : [];
  });
  return finished.length > 0 ? finished : labels.map((_, index) => index);
}

/** "Oct 2026": how the reports label the month a day is in. */
export function monthLabel(day: Date): string {
  return `${MONTH_NAMES[day.getMonth()]} ${day.getFullYear()}`;
}
