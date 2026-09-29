import { Chart } from 'chart.js';
import { ChartHelper, formatCurrency, visibleMonthlyAverage } from './chart-helper';
import { CategorizedReportOutputDto } from '../../core/models/outputs/categorized-report-output-dto';
import { categoryRefs } from '../../testing/test-categories';

const report: CategorizedReportOutputDto = {
  averageMonthlyTotal: 1200,
  categories: categoryRefs('Dining', 'Rent'),
  monthlyData: [
    { month: 'Aug 2026', total: 1200, categoryValues: { Dining: 200, Rent: 1000 } },
    { month: 'Sep 2026', total: 1100, categoryValues: { Rent: 1000, Dining: 100 } },
  ],
};
// Mid-September: August is over, September is still running.
const midSeptember = new Date(2026, 8, 15);

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
      categories: categoryRefs('Dining', 'Rent', 'Pet'),
    });

    expect(chartData.labels).toEqual(['Aug 2026', 'Sep 2026']);
    expect(chartData.datasets.map((d) => d.label)).toEqual(['Dining', 'Rent', 'Pet']);
    // Each category's own colour, from the report.
    expect(chartData.datasets.map((d) => d.backgroundColor)).toEqual([
      '#1F76B5',
      '#E277C3',
      '#8C564B',
    ]);
    expect(chartData.datasets[0].data).toEqual([200, 100]);
    expect(chartData.datasets[2].data).toEqual([0, 0]);
  });

  function averageLine(now: Date): number {
    const { chartOptions } = ChartHelper.generateMonthlySpendingChartConfiguration(
      report,
      undefined,
      now,
    );
    const annotations = chartOptions?.plugins?.annotation?.annotations as Record<
      string,
      { yMin: number }
    >;
    return annotations['avgLine'].yMin;
  }

  it('places the average line at the mean of the finished months', () => {
    expect(averageLine(midSeptember)).toBe(1200);
    // Once September is over too, it counts.
    expect(averageLine(new Date(2026, 9, 2))).toBe(1150);
  });

  it('uses the first month for the doughnut chart', () => {
    const { chartData } = ChartHelper.generateDoughnutChartConfiguration(report);

    expect(chartData.labels).toEqual(['Dining', 'Rent']);
    expect(chartData.datasets[0].data).toEqual([200, 1000]);
  });

  it('handles a report with no months', () => {
    const { chartData } = ChartHelper.generateDoughnutChartConfiguration({
      categories: categoryRefs('Rent'),
      monthlyData: [],
      averageMonthlyTotal: 0,
    });

    expect(chartData.datasets[0].data).toEqual([0]);
  });
});

describe('cash-flow chart', () => {
  const cashFlow = {
    months: [
      { month: 'Aug 2026', income: 5000, spending: 3200, net: 1800, saved: 1000 },
      { month: 'Sep 2026', income: 2500, spending: 300, net: 2200, saved: -200 },
    ],
    averageMonthlyIncome: 5000,
    averageMonthlySpending: 3200,
    averageMonthlySaved: 1000,
  };

  it('puts income, spending and saved side by side per month', () => {
    const { chartData, chartOptions } = ChartHelper.generateCashFlowChartConfiguration(cashFlow);

    expect(chartData.labels).toEqual(['Aug 2026', 'Sep 2026']);
    expect(chartData.datasets.map((d) => [d.label, d.data])).toEqual([
      ['Income', [5000, 2500]],
      ['Spending', [3200, 300]],
      ['Saved', [1000, -200]],
    ]);
    expect(chartOptions?.scales?.['x']?.stacked).toBeUndefined();
  });

  it('adds the month’s net to the tooltip', () => {
    const { chartOptions } = ChartHelper.generateCashFlowChartConfiguration(cashFlow);
    const footer = chartOptions!.plugins!.tooltip!.callbacks!.footer as unknown as (
      items: { dataIndex: number }[],
    ) => string;

    expect(footer([{ dataIndex: 1 }])).toBe('Net: $2,200.00');
  });
});

describe('visibleMonthlyAverage', () => {
  it('averages only visible datasets over the given months', () => {
    const chart = fakeChart(
      [
        [200, 100, 30],
        [1000, 1000, 0],
      ],
      [1],
    );

    expect(visibleMonthlyAverage(chart, [0, 1])).toBe(150);
    expect(visibleMonthlyAverage(chart, [0, 1, 2])).toBe(110);
  });

  it('returns 0 when there are no months', () => {
    expect(visibleMonthlyAverage(fakeChart([]), [])).toBe(0);
  });
});

describe('formatCurrency', () => {
  it('formats as Canadian dollars', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
  });
});
