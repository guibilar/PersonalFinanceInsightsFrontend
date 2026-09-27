export interface MonthlyCategoryValuesDto {
  month: string;
  total: number;
  categoryValues: Record<string, number>;
}

export interface CategorizedReportOutputDto {
  categories: string[];
  monthlyData: MonthlyCategoryValuesDto[];
  averageMonthlyTotal: number;
  /**
   * Current-month report only: last month's spending up to the same day of the month (all of it when it is
   * shorter). Null in the year report; absent from APIs older than the field.
   */
  previousMonthToDateTotal?: number | null;
}
