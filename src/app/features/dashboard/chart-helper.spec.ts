import { Chart } from 'chart.js';
import { ChartHelper, formatCurrency, visibleMonthlyAverage } from './chart-helper';
import { CategorizedReportOutputDto } from '../../core/models/outputs/categorized-report-output-dto';

const report: CategorizedReportOutputDto = {
  averageMonthlyTotal: 1200,
  categories: ['Dining', 'Rent'],
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
      categories: ['Dining', 'Rent', 'Pet'],
    });

    expect(chartData.labels).toEqual(['Aug 2026', 'Sep 2026']);
    expect(chartData.datasets.map((d) => d.label)).toEqual(['Dining', 'Rent', 'Pet']);
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
      categories: ['Rent'],
      monthlyData: [],
      averageMonthlyTotal: 0,
    });

    expect(chartData.datasets[0].data).toEqual([0]);
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
