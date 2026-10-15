/** One journal entry: the text of one day (Hestia.Api, Journal module, T21). Days are `yyyy-MM-dd`. */
export interface JournalEntryDto {
  id: string;
  day: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

/** An entry in a list: the start of its text, on one line. */
export interface JournalEntrySummaryDto {
  id: string;
  day: string;
  /** At most 200 characters; longer texts end with "…". */
  excerpt: string;
  /** The length of the whole text. */
  length: number;
  updatedAt: string;
}

/** A day of the week strip. */
export interface JournalDayDto {
  day: string;
  written: boolean;
}

/** An entry of the same day in an earlier year. */
export interface OnThisDayDto {
  yearsAgo: number;
  entry: JournalEntrySummaryDto;
}

/** The Journal page: today's entry, the streak, the week, and "On this day". */
export interface JournalSummaryDto {
  /** Today in the time zone of the server. */
  date: string;
  /** Days in a row with an entry, up to today (or up to yesterday while today has none). */
  streak: number;
  /** The last 7 days, oldest first; the last one is today. */
  week: JournalDayDto[];
  today: JournalEntryDto | null;
  onThisDay: OnThisDayDto[];
  entryCount: number;
}
