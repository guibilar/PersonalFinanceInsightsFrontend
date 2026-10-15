import { IconName } from '../../shared/ui/icon/icon.component';
import { TimelineEntry } from '../../core/models/outputs/timeline-output-dto';

/** The module filters of the Timeline, in the order of the menu. `null`: all modules. */
export const TIMELINE_FILTERS: readonly { label: string; module: string | null }[] = [
  { label: 'All', module: null },
  { label: 'Money', module: 'Money' },
  { label: 'Documents', module: 'Documents' },
  { label: 'Tasks', module: 'Tasks' },
  { label: 'Home', module: 'Home' },
  { label: 'People', module: 'People' },
  { label: 'Journal', module: 'Journal' },
];

/** How many days one page has. */
export const TIMELINE_PAGE_DAYS = 14;

const KIND_ICONS: Record<string, IconName> = {
  transaction: 'banknote',
  'month-review': 'calendar',
  'document-added': 'file-text',
  'task-done': 'list-checks',
  'item-added': 'house',
  contact: 'users',
  loan: 'user',
  'gift-given': 'user',
  'person-added': 'users',
  entry: 'book-open',
};

/** The icon of an entry, by its kind; a kind not in the list gets a general icon. */
export function entryIcon(entry: TimelineEntry): IconName {
  return KIND_ICONS[entry.kind] ?? 'history';
}

/** "Today · Sat Oct 10", "Yesterday · Fri Oct 9", "Thu Oct 8", or "Thu Oct 8, 2025" in another year. */
export function dayHeading(day: string, today: string): string {
  const date = new Date(`${day}T00:00:00`);
  const sameYear = day.slice(0, 4) === today.slice(0, 4);
  const label = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  const plain = label.replace(',', '');
  const yesterday = new Date(`${today}T00:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === today) return `Today · ${plain}`;
  if (date.getTime() === yesterday.getTime()) return `Yesterday · ${plain}`;
  return sameYear ? plain : label;
}

/** "14:20" for an entry with a time, in the browser's time zone; empty for one of a whole day. */
export function entryTime(entry: TimelineEntry): string {
  if (!entry.at) return '';
  return new Date(entry.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
