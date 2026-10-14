import { TodayModuleStatus, TodaySeverity, TodayValue } from './today-output-dto';

/**
 * The answer of `GET /api/alerts` (Hestia.Api, module Alerts): the open "Needs attention" items of all modules.
 * Written by hand from the HestiaBackend contracts (`Hestia.Modules.Alerts.Contracts`, `AlertList`).
 */
export interface AlertListDto {
  /** When the last check of all sources finished; null when none did since the host started. */
  checkedAt: string | null;
  /** Each module that has alert rules, with its status, in module order. */
  modules: AlertModuleDto[];
  /** The open alerts: most severe first, then newest first. */
  alerts: AlertDto[];
}

export interface AlertModuleDto {
  /** The module name, for example "Money". */
  module: string;
  /** Its place on Today: lower first. */
  order: number;
  /**
   * `Partial`: some data did not load in the last check, so the stored alerts show. `Failed`: no check worked since
   * the host started, and the module has no stored alerts. The same names as the Today module status.
   */
  status: TodayModuleStatus;
}

/**
 * One open alert. It has the fields of a Today "Needs attention" card (without `value` and `trend`), so the same
 * text filler (`features/today/today-text.ts`) and the same list show both.
 */
export interface AlertDto {
  /** The stable key, the Today card id, for example `money.budget-over.<budget id>`. */
  id: string;
  /** This alert. When a condition ends and comes back, the new alert has a new id. */
  alertId: string;
  module: string;
  /** Always `Attention`. */
  type: 'Attention';
  /** What the alert is about, inside its module, for example `budget-over`. */
  kind: string;
  title: string;
  /** The sentence, with placeholders such as `{name}`. */
  text: string;
  values: Record<string, TodayValue>;
  severity: TodaySeverity;
  /** A route of this app, for example `/money/transactions#import`; null for none. */
  link: string | null;
  /** When a check first found the condition. */
  raisedAt: string;
  /** When a check last changed the text, a value or the severity. */
  updatedAt: string;
}
