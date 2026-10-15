/** One thing that happened in a module (Hestia.Api, Timeline module, T16). Days are `yyyy-MM-dd`. */
export interface TimelineEntry {
  /** Stable and unique, for example `documents.document-added.<id>`. */
  id: string;
  /** The module, for example `Documents`. */
  module: string;
  /** What happened inside the module, for example `document-added`. The icon follows it. */
  kind: string;
  day: string;
  /** When it happened, or null for a thing of a whole day. */
  at: string | null;
  title: string;
  text: string | null;
  /** Money in is positive, money out negative. */
  amount: number | null;
  /** The web route of the thing, for example `/documents/<id>`. */
  link: string | null;
}

/** One day, with its entries: those with a time newest first, then those of the whole day. */
export interface TimelineDayDto {
  day: string;
  entries: TimelineEntry[];
}

export type TimelineModuleStatus = 'Complete' | 'Partial' | 'Failed';

export interface TimelineModuleDto {
  module: string;
  status: TimelineModuleStatus;
}

/** One page of the Timeline: the days from `from` to `to`, newest first (only days with entries). */
export interface TimelineDto {
  today: string;
  from: string;
  to: string;
  /** The `before` of the next page. */
  earlier: string;
  days: TimelineDayDto[];
  modules: TimelineModuleDto[];
}
