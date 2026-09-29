import { CashFlowReportOutputDto } from '../../core/models/outputs/cash-flow-report-output-dto';
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
  const cashFlow: CashFlowReportOutputDto = {
    months: [
      { month: 'Aug 2026', income: 5000, spending: 3200, net: 1800, savingsChange: 1000 },
      { month: 'Sep 2026', income: 2500, spending: 3000, net: -500, savingsChange: -200 },
    ],
    averageMonthlyIncome: 5000,
    averageMonthlySpending: 3200,
    averageMonthlyNet: 1800,
    averageMonthlySavingsChange: 1000,
    averagedMonths: 1,
    averagesIncludeCurrentMonth: false,
  };

  it('puts income, spending and what was left over side by side per month', () => {
    const { chartData, chartOptions } = ChartHelper.generateCashFlowChartConfiguration(cashFlow);

    expect(chartData.labels).toEqual(['Aug 2026', 'Sep 2026']);
    expect(chartData.datasets.map((d) => [d.label, d.data])).toEqual([
      ['Income', [5000, 2500]],
      ['Spending', [3200, 3000]],
      ['Left over', [1800, -500]],
      ['Savings change', [1000, -200]],
    ]);
    expect(chartOptions?.scales?.['x']?.stacked).toBeUndefined();
  });

  it('leaves the savings change out when no savings account changed', () => {
    const { chartData } = ChartHelper.generateCashFlowChartConfiguration({
      ...cashFlow,
      months: cashFlow.months.map((month) => ({ ...month, savingsChange: 0 })),
    });

    expect(chartData.datasets.map((d) => d.label)).toEqual(['Income', 'Spending', 'Left over']);
  });

  it('labels each bar with its amount in the tooltip', () => {
    const { chartOptions } = ChartHelper.generateCashFlowChartConfiguration(cashFlow);
    const label = chartOptions!.plugins!.tooltip!.callbacks!.label as unknown as (context: {
      dataset: { label: string };
      raw: number;
    }) => string;

    expect(label({ dataset: { label: 'Left over' }, raw: -500 })).toBe('Left over: -$500.00');
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

  it('hands a clicked bar segment on as its category and month, and a slice as its category', () => {
    const picked: string[] = [];
    const monthly = ChartHelper.generateMonthlySpendingChartConfiguration(
      report,
      undefined,
      midSeptember,
      (category, month) => picked.push(`${category.name} ${month}`),
    );
    const doughnut = ChartHelper.generateDoughnutChartConfiguration(report, undefined, (category) =>
      picked.push(category.name),
    );
    type Click = (event: unknown, elements: { datasetIndex: number; index: number }[]) => void;

    (monthly.chartOptions!.onClick as Click)({}, [{ datasetIndex: 1, index: 0 }]);
    (doughnut.chartOptions!.onClick as Click)({}, [{ datasetIndex: 0, index: 0 }]);

    expect(picked).toEqual(['Rent Aug 2026', 'Dining']);
  });

  it('is not clickable without somewhere to go', () => {
    expect(
      ChartHelper.generateDoughnutChartConfiguration(report).chartOptions!.onClick,
    ).toBeUndefined();
  });
});
