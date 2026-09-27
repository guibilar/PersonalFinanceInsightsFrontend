import { Chart } from 'chart.js';
import { ChartHelper, formatCurrency, visibleMonthlyAverage } from './chart-helper';
import { CategorizedReportOutputDto } from '../../core/models/outputs/categorized-report-output-dto';

const report: CategorizedReportOutputDto = {
  categories: ['Dining', 'Rent'],
  monthlyData: [
    { month: 'Aug', total: 1200, categoryValues: { Dining: 200, Rent: 1000 } },
    { month: 'Sep', total: 1100, categoryValues: { Rent: 1000, Dining: 100 } },
  ],
};

function fakeChart(datasets: number[][], hidden: number[] = []): Chart {
  return {
    data: {
      labels: datasets[0]?.map((_, i) => `m${i}`) ?? [],
      datasets: datasets.map((data) => ({ data })),
    },
    isDatasetVisible: (index: number) => !hidden.includes(index),
  } as unknown as Chart;
}

describe('ChartHelper', () => {
  it('builds one stacked dataset per category, filling missing months with 0', () => {
    const { chartData } = ChartHelper.generateMonthlySpendingChartConfiguration({
      ...report,
      categories: ['Dining', 'Rent', 'Pet'],
    });

    expect(chartData.labels).toEqual(['Aug', 'Sep']);
    expect(chartData.datasets.map((d) => d.label)).toEqual(['Dining', 'Rent', 'Pet']);
    expect(chartData.datasets[0].data).toEqual([200, 100]);
    expect(chartData.datasets[2].data).toEqual([0, 0]);
  });

  it('places the average line at the mean monthly total', () => {
    const { chartOptions } = ChartHelper.generateMonthlySpendingChartConfiguration(report);
    const annotations = chartOptions?.plugins?.annotation?.annotations as Record<
      string,
      { yMin: number }
    >;

    expect(annotations['avgLine'].yMin).toBe(1150);
  });

  it('uses the first month for the doughnut chart', () => {
    const { chartData } = ChartHelper.generateDoughnutChartConfiguration(report);

    expect(chartData.labels).toEqual(['Dining', 'Rent']);
    expect(chartData.datasets[0].data).toEqual([200, 1000]);
  });

  it('handles a report with no months', () => {
    const { chartData } = ChartHelper.generateDoughnutChartConfiguration({
      categories: ['Rent'],
      monthlyData: [],
    });

    expect(chartData.datasets[0].data).toEqual([0]);
  });
});

describe('visibleMonthlyAverage', () => {
  it('averages only visible datasets across all months', () => {
    const chart = fakeChart(
      [
        [200, 100],
        [1000, 1000],
      ],
      [1],
    );

    expect(visibleMonthlyAverage(chart)).toBe(150);
  });

  it('returns 0 when there are no months', () => {
    expect(visibleMonthlyAverage(fakeChart([]))).toBe(0);
  });
});

describe('formatCurrency', () => {
  it('formats as Canadian dollars', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
  });
});
