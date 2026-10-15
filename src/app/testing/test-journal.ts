import {
  JournalEntryDto,
  JournalEntrySummaryDto,
  JournalSummaryDto,
} from '../core/models/outputs/journal-output-dto';
import { PaginatedResult } from '../core/models/outputs/paginated-result-output-dto';

export const JOURNAL_TODAY = '2026-10-10';

export function testEntry(changes: Partial<JournalEntryDto> = {}): JournalEntryDto {
  return {
    id: 'e-today',
    day: JOURNAL_TODAY,
    text: 'Finished the handouts. Long walk by the river.',
    createdAt: '2026-10-10T20:00:00Z',
    updatedAt: '2026-10-10T20:00:00Z',
    ...changes,
  };
}

export function testEntrySummary(
  changes: Partial<JournalEntrySummaryDto> = {},
): JournalEntrySummaryDto {
  return {
    id: 'e1',
    day: '2026-10-09',
    excerpt: 'Board game night with Marco.',
    length: 28,
    updatedAt: '2026-10-09T22:00:00Z',
    ...changes,
  };
}

/** Saturday Oct 10: a 6-day streak up to yesterday, not written today, one memory from a year ago. */
export function testJournalSummary(changes: Partial<JournalSummaryDto> = {}): JournalSummaryDto {
  const week = ['04', '05', '06', '07', '08', '09', '10'].map((d) => ({
    day: `2026-10-${d}`,
    written: d !== '10',
  }));
  return {
    date: JOURNAL_TODAY,
    streak: 6,
    week,
    today: null,
    onThisDay: [
      {
        yearsAgo: 1,
        entry: testEntrySummary({
          id: 'e-2025',
          day: '2025-10-10',
          excerpt: 'Moved the desk to the window. Much better light.',
        }),
      },
    ],
    entryCount: 7,
    ...changes,
  };
}

export function testJournalPage(
  items: JournalEntrySummaryDto[],
  totalCount = items.length,
): PaginatedResult<JournalEntrySummaryDto> {
  return {
    items,
    page: 1,
    pageSize: 50,
    totalCount,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
  };
}
