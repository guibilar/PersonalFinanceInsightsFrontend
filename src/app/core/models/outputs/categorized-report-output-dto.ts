import { CategoryReference } from './category-output-dto';

export interface MonthlyCategoryValuesDto {
  month: string;
  total: number;
  /** Spending per category, by category name. */
  categoryValues: Record<string, number>;
}

export interface CategorizedReportOutputDto {
  /** The categories with spending in the report, by name, with their colours. */
  categories: CategoryReference[];
  monthlyData: MonthlyCategoryValuesDto[];
  averageMonthlyTotal: number;
  /** How many months the average is over; absent from APIs older than the field. */
  averagedMonths?: number;
  /**
   * True when no month of the year is over yet (January), so the average is the running month's; absent from APIs
   * older than the field.
   */
  averageIncludesCurrentMonth?: boolean;
  /**
   * Current-month report only: last month's spending up to the same day of the month (all of it when it is
   * shorter). Null in the year report; absent from APIs older than the field.
   */
  previousMonthToDateTotal?: number | null;
}
