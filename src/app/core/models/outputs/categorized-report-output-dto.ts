export interface MonthlyCategoryValuesDto {
  month: string;
  total: number;
  categoryValues: Record<string, number>;
}

export interface CategorizedReportOutputDto {
  categories: string[];
  monthlyData: MonthlyCategoryValuesDto[];
}
