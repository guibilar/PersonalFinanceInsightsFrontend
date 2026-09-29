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
  /**
   * Current-month report only: last month's spending up to the same day of the month (all of it when it is
   * shorter). Null in the year report; absent from APIs older than the field.
   */
  previousMonthToDateTotal?: number | null;
}
