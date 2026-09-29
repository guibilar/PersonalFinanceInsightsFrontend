import { Chart, ChartConfiguration, ChartData, ChartOptions } from 'chart.js';
// The plugin's typings add `plugins.annotation` to the chart options (registered in the dashboard).
import type {} from 'chartjs-plugin-annotation';
import { CategorizedReportOutputDto } from '../../core/models/outputs/categorized-report-output-dto';
import { CategoryReference } from '../../core/models/outputs/category-output-dto';
import { CashFlowReportOutputDto } from '../../core/models/outputs/cash-flow-report-output-dto';
import { finishedMonths } from './dashboard-stats';

const AVERAGE_COLOR = 'red';

/** The theme's success, danger and primary colours (styles.scss), so the bars match the rest of the app. */
export const CASH_FLOW_COLORS = {
  income: '#16a34a',
  spending: '#dc2626',
  net: '#4f46e5',
  savings: '#0ea5e9',
} as const;
const AVERAGE_ANNOTATION_ID = 'avgLine';

/** Whether the savings accounts changed in any month: nothing recorded on one is not the same as nothing saved. */
export function hasSavingsChange(report: CashFlowReportOutputDto): boolean {
  return report.months.some((month) => month.savingsChange !== 0);
}

const currencyFormatter = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

/** Average monthly spend over the given months (positions), across the categories visible in the chart. */
export function visibleMonthlyAverage(chart: Chart, months: number[]): number {
  if (months.length === 0) {
    return 0;
  }
  const total = chart.data.datasets.reduce((sum, dataset, index) => {
    if (!chart.isDatasetVisible(index)) {
      return sum;
    }
    const data = dataset.data as number[];
    return sum + months.reduce((datasetSum, month) => datasetSum + (data[month] ?? 0), 0);
  }, 0);
  return total / months.length;
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

/** Click and hover handlers that hand the clicked element on, with a pointer over anything clickable. */
function pickable(
  pick: (element: { datasetIndex: number; index: number }) => void,
  enabled: boolean,
): Pick<ChartOptions, 'onClick' | 'onHover'> {
  if (!enabled) return {};
  return {
    onClick: (_event, elements) => {
      if (elements[0]) pick(elements[0]);
    },
    onHover: (event, elements) => {
      const target = event.native?.target as HTMLElement | undefined;
      if (target) target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
    },
  };
}

export class ChartHelper {
  /** `onPick`: a bar segment was clicked, with its category and month (as the report has them). */
  static generateMonthlySpendingChartConfiguration(
    report: CategorizedReportOutputDto,
    theme: ChartTheme = CHART_THEMES.light,
    now: Date = new Date(),
    onPick?: (category: CategoryReference, month: string) => void,
  ): {
    chartData: ChartData<'bar'>;
    chartOptions: ChartConfiguration<'bar'>['options'];
  } {
    const chartData: ChartData<'bar'> = {
      labels: report.monthlyData.map((monthData) => monthData.month),
      datasets: report.categories.map((category) => ({
        label: category.name,
        data: report.monthlyData.map((monthData) => monthData.categoryValues[category.name] || 0),
        backgroundColor: category.color,
      })),
    };

    // Finished months only, like the API's average: the running month isn't over yet.
    const averaged = finishedMonths(
      report.monthlyData.map((monthData) => monthData.month),
      now,
    );
    // Same formula the legend uses, applied before any category is hidden.
    const total = averaged.reduce(
      (sum, month) =>
        sum +
        report.categories.reduce(
          (monthSum, category) =>
            monthSum + (report.monthlyData[month].categoryValues[category.name] || 0),
          0,
        ),
      0,
    );
    const initialAverage = averaged.length > 0 ? total / averaged.length : 0;

    const chartOptions: ChartConfiguration<'bar'>['options'] = {
      responsive: true,
      maintainAspectRatio: false,
      ...pickable((element) => {
        const category = report.categories[element.datasetIndex];
        const month = report.monthlyData[element.index]?.month;
        if (category && month && onPick) onPick(category, month);
      }, !!onPick),
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
                text: `Avg: ${formatCurrency(visibleMonthlyAverage(chart, averaged))}`,
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
            moveAverageLine(chart, visibleMonthlyAverage(chart, averaged));
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

  /** `onPick`: a slice was clicked, with its category. */
  static generateDoughnutChartConfiguration(
    report: CategorizedReportOutputDto,
    theme: ChartTheme = CHART_THEMES.light,
    onPick?: (category: CategoryReference) => void,
  ): {
    chartData: ChartData<'doughnut'>;
    chartOptions: ChartConfiguration<'doughnut'>['options'];
  } {
    const categories = report.categories ?? [];
    const currentMonth = report.monthlyData[0]?.categoryValues ?? {};

    const chartData: ChartData<'doughnut'> = {
      labels: categories.map((category) => category.name),
      datasets: [
        {
          data: categories.map((category) => currentMonth[category.name] || 0),
          backgroundColor: categories.map((category) => category.color),
          borderColor: theme.surface,
        },
      ],
    };

    const chartOptions: ChartConfiguration<'doughnut'>['options'] = {
      responsive: true,
      maintainAspectRatio: false,
      ...pickable((element) => {
        const category = categories[element.index];
        if (category && onPick) onPick(category);
      }, !!onPick),
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

  /**
   * Income, spending and what was left over side by side per month, plus how the savings accounts changed when
   * any month has that (without savings accounts it would be a row of empty bars).
   */
  static generateCashFlowChartConfiguration(
    report: CashFlowReportOutputDto,
    theme: ChartTheme = CHART_THEMES.light,
  ): {
    chartData: ChartData<'bar'>;
    chartOptions: ChartConfiguration<'bar'>['options'];
  } {
    const months = report.months;
    const chartData: ChartData<'bar'> = {
      labels: months.map((month) => month.month),
      datasets: [
        {
          label: 'Income',
          data: months.map((month) => month.income),
          backgroundColor: CASH_FLOW_COLORS.income,
        },
        {
          label: 'Spending',
          data: months.map((month) => month.spending),
          backgroundColor: CASH_FLOW_COLORS.spending,
        },
        {
          label: 'Left over',
          data: months.map((month) => month.net),
          backgroundColor: CASH_FLOW_COLORS.net,
        },
      ],
    };
    if (hasSavingsChange(report)) {
      chartData.datasets.push({
        label: 'Savings change',
        data: months.map((month) => month.savingsChange),
        backgroundColor: CASH_FLOW_COLORS.savings,
      });
    }

    const chartOptions: ChartConfiguration<'bar'>['options'] = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: theme.text }, grid: { color: theme.grid } },
        y: { ticks: { color: theme.text }, grid: { color: theme.grid } },
      },
      plugins: {
        legend: { position: 'bottom', align: 'start', labels: { color: theme.text } },
        tooltip: {
          callbacks: {
            label: (context) =>
              `${context.dataset.label}: ${formatCurrency(context.raw as number)}`,
          },
        },
      },
    };

    return { chartData, chartOptions };
  }
}
