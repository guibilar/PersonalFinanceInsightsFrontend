/**
 * The answer of `GET /api/today` (Hestia.Api, module Today): all cards of the Today page, from all modules, in display
 * order. Written by hand from the Hestia OpenAPI document (`Hestia.Modules.Today.Contracts`).
 */
export interface TodayDto {
  /** The day the cards are for, in the host's time zone ("2026-10-13"). */
  date: string;
  /** When the host made this answer; it keeps a complete answer for a short time. */
  generatedAt: string;
  /** Each module that gives cards, with its status. A failed module gives no cards. */
  modules: TodayModuleDto[];
  /** First the tiles, then the "Needs attention" items, each group in module order. */
  cards: TodayCard[];
  /** "Your day" (T106): the Calendar of today and of the next days. Null when the Calendar did not answer. */
  agenda?: TodayAgendaDto | null;
  /** "On this day" (T106): this day in earlier years, newest first. */
  memories?: TodayMemoryDto[] | null;
}

/** "Your day" (T106). */
export interface TodayAgendaDto {
  /** The items that touch today: whole days first, then by time. */
  today: TodayAgendaItem[];
  /** The items that start in the next 7 days, soonest first (at most 8). */
  upcoming: TodayAgendaItem[];
  /** False when a module's items did not load. */
  complete: boolean;
}

/** One thing of "Your day": the fields of a Calendar item (`GET /api/calendar`). */
export interface TodayAgendaItem {
  id: string;
  module: string;
  kind: string;
  title: string;
  text: string | null;
  allDay: boolean;
  startDate: string;
  endDate: string;
  startsAt: string | null;
  endsAt: string | null;
  link: string | null;
  eventId: string | null;
  /** For a task: false while it is open. */
  done: boolean | null;
}

/** Something from this day in an earlier year, for example a journal entry. */
export interface TodayMemoryDto {
  module: string;
  kind: string;
  yearsAgo: number;
  day: string;
  text: string;
  link: string | null;
}

export type TodayModuleStatus = 'Complete' | 'Partial' | 'Failed';

export interface TodayModuleDto {
  /** The module name, for example "Money". */
  module: string;
  status: TodayModuleStatus;
}

export type TodayCardType = 'Tile' | 'Attention';
export type TodaySeverity = 'Neutral' | 'Good' | 'Warning' | 'Bad';
export type TodayTrend = 'Up' | 'Down';
export type TodayValueType = 'Money' | 'Count' | 'Percent' | 'Date' | 'Text';

/** One value on a card. `type` says which of `number`, `text` and `date` is set. */
export interface TodayValue {
  type: TodayValueType;
  number?: number | null;
  text?: string | null;
  /** A calendar day ("2026-06-30"). */
  date?: string | null;
}

/**
 * One card on Today. The server does not format amounts or dates: `text` has placeholders such as `{difference}`,
 * and `values` has a value for each one.
 */
export interface TodayCard {
  /** Stable for the same thing, for example `money.budget-over.<id>`. */
  id: string;
  module: string;
  type: TodayCardType;
  /** What the card shows inside its module, for example `spent` or `budget-over`. */
  kind: string;
  /** The tile label, or a short name of the attention kind. */
  title: string;
  /** The big value of a tile; null when it is not known. */
  value: TodayValue | null;
  /** The tile hint or the attention sentence, with placeholders; null when there is nothing to say. */
  text: string | null;
  values: Record<string, TodayValue>;
  severity: TodaySeverity;
  trend: TodayTrend | null;
  /** A route of this app, for example `/money/budgets` or `/money/rules#unsorted`; null for none. */
  link: string | null;
}
