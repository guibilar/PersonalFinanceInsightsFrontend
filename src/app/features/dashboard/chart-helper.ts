import { Chart, ChartConfiguration, ChartData } from 'chart.js';
import { CategoryColorHelper } from '../../shared/utils/category-color-helper';
import { CategorizedReportOutputDto } from '../../core/models/outputs/categorized-report-output-dto';

const AVERAGE_COLOR = 'red';
const AVERAGE_ANNOTATION_ID = 'avgLine';

const currencyFormatter = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

/** Average monthly spend across the categories currently visible in the chart. */
export function visibleMonthlyAverage(chart: Chart): number {
  const months = chart.data.labels?.length ?? 0;
  if (months === 0) {
    return 0;
  }
  const total = chart.data.datasets.reduce((sum, dataset, index) => {
    if (!chart.isDatasetVisible(index)) {
      return sum;
    }
    return sum + (dataset.data as number[]).reduce((datasetSum, value) => datasetSum + value, 0);
  }, 0);
  return total / months;
}

function moveAverageLine(chart: Chart, average: number): void {
  const annotations = chart.options.plugins?.annotation?.annotations;
  if (!annotations || Array.isArray(annotations)) {
    return;
  }
  const line = annotations[AVERAGE_ANNOTATION_ID];
  if (line?.type === 'line') {
    line.yMin = average;
    line.yMax = average;
  }
}

/** Colours that depend on light/dark mode. */
export interface ChartTheme {
  text: string;
  grid: string;
  /** Surface behind the chart, used to separate doughnut slices. */
  surface: string;
}

export const CHART_THEMES: Record<'light' | 'dark', ChartTheme> = {
  light: { text: '#4b5563', grid: '#e4e7ee', surface: '#ffffff' },
  dark: { text: '#cbd5e1', grid: '#2a3140', surface: '#171b24' },
};

export class ChartHelper {
  static generateMonthlySpendingChartConfiguration(
    report: CategorizedReportOutputDto,
    theme: ChartTheme = CHART_THEMES.light,
  ): {
    chartData: ChartData<'bar'>;
    chartOptions: ChartConfiguration<'bar'>['options'];
  } {
    const chartData: ChartData<'bar'> = {
      labels: report.monthlyData.map((monthData) => monthData.month),
      datasets: report.categories.map((category) => ({
        label: category,
        data: report.monthlyData.map((monthData) => monthData.categoryValues[category] || 0),
        backgroundColor: CategoryColorHelper.getColor(category),
      })),
    };

    // Same formula the legend uses, applied before any category is hidden.
    const months = report.monthlyData.length;
    const total = report.monthlyData.reduce(
      (sum, monthData) =>
        sum +
        report.categories.reduce(
          (monthSum, category) => monthSum + (monthData.categoryValues[category] || 0),
          0,
        ),
      0,
    );
    const initialAverage = months > 0 ? total / months : 0;

    const chartOptions: ChartConfiguration<'bar'>['options'] = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, ticks: { color: theme.text }, grid: { color: theme.grid } },
        y: { stacked: true, ticks: { color: theme.text }, grid: { color: theme.grid } },
      },
      plugins: {
        legend: {
          position: 'bottom',
          align: 'start',
          labels: {
            color: theme.text,
            // Category entries plus an extra, non-toggleable "Avg" entry for the average line.
            generateLabels: (chart) => [
              ...Chart.defaults.plugins.legend.labels.generateLabels(chart),
              {
                text: `Avg: ${formatCurrency(visibleMonthlyAverage(chart))}`,
                fillStyle: AVERAGE_COLOR,
                strokeStyle: AVERAGE_COLOR,
                lineWidth: 2,
              },
            ],
          },
          onClick: (_event, legendItem, legend) => {
            const index = legendItem.datasetIndex;
            if (index === undefined) {
              return; // the "Avg" entry
            }
            const chart = legend.chart;
            chart.setDatasetVisibility(index, !chart.isDatasetVisible(index));
            moveAverageLine(chart, visibleMonthlyAverage(chart));
            chart.update();
          },
        },
        tooltip: {
          callbacks: {
            label: (context) => formatCurrency(context.raw as number),
          },
        },
        annotation: {
          annotations: {
            [AVERAGE_ANNOTATION_ID]: {
              type: 'line',
              borderDash: [6, 3],
              yMin: initialAverage,
              yMax: initialAverage,
              borderColor: AVERAGE_COLOR,
              borderWidth: 2,
            },
          },
        },
      },
    };

    return { chartData, chartOptions };
  }

  static generateDoughnutChartConfiguration(
    report: CategorizedReportOutputDto,
    theme: ChartTheme = CHART_THEMES.light,
  ): {
    chartData: ChartData<'doughnut'>;
    chartOptions: ChartConfiguration<'doughnut'>['options'];
  } {
    const categories = report.categories ?? [];
    const currentMonth = report.monthlyData[0]?.categoryValues ?? {};

    const chartData: ChartData<'doughnut'> = {
      labels: categories,
      datasets: [
        {
          data: categories.map((category) => currentMonth[category] || 0),
          backgroundColor: categories.map((category) => CategoryColorHelper.getColor(category)),
          borderColor: theme.surface,
        },
      ],
    };

    const chartOptions: ChartConfiguration<'doughnut'>['options'] = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        // The dashboard lists categories with amounts right below the doughnut.
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => formatCurrency(context.raw as number),
          },
        },
      },
    };

    return { chartData, chartOptions };
  }
}
