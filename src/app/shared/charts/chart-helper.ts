import { Chart, ChartConfiguration, ChartData, ChartOptions, Plugin } from 'chart.js';
// The plugin's typings add `plugins.annotation` to the chart options (registered in the dashboard).
import type {} from 'chartjs-plugin-annotation';
import { CategorizedReportOutputDto } from '../../core/models/outputs/categorized-report-output-dto';
import { CategoryReference } from '../../core/models/outputs/category-output-dto';
import { CashFlowReportOutputDto } from '../../core/models/outputs/cash-flow-report-output-dto';
import { finishedMonths } from '../utils/months';
import { formatCurrency } from '../utils/format';
import {
  ChartTheme,
  CHART_THEMES,
  cashFlowColors,
  valueAxis,
  categoryAxis,
  legendStyle,
  tooltipStyle,
  BAR_MARKS,
  FONT_FAMILY,
  ANIMATION,
} from './chart-theme';

const AVERAGE_ANNOTATION_ID = 'avgLine';

/** Whether the savings accounts changed in any month: nothing recorded on one is not the same as nothing saved. */
export function hasSavingsChange(report: CashFlowReportOutputDto): boolean {
  return report.months.some((month) => month.savingsChange !== 0);
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

/** The total and a caption in the middle of a doughnut, so the ring doesn't have to be read for its sum. */
function centerLabel(theme: ChartTheme, total: number, caption: string): Plugin<'doughnut'> {
  return {
    id: 'centerLabel',
    afterDatasetsDraw: (chart) => {
      const { ctx, chartArea } = chart;
      const x = (chartArea.left + chartArea.right) / 2;
      const y = (chartArea.top + chartArea.bottom) / 2;
      const size = Math.max(14, Math.min(26, (chartArea.right - chartArea.left) / 9));
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = theme.strong;
      ctx.font = `600 ${size}px ${FONT_FAMILY}`;
      ctx.fillText(formatCurrency(total), x, y - size * 0.35);
      ctx.fillStyle = theme.muted;
      ctx.font = `500 ${Math.max(11, size * 0.5)}px ${FONT_FAMILY}`;
      ctx.fillText(caption, x, y + size * 0.65);
      ctx.restore();
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
        ...BAR_MARKS,
        // Every segment rounded, and a gap of the surface's colour between neighbours.
        borderSkipped: false,
        borderWidth: 2,
        borderColor: theme.surface,
        categoryPercentage: 0.8,
        barPercentage: 0.75,
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
      animation: ANIMATION,
      layout: { padding: { top: 8, right: 4 } },
      // A click lands on the segment under the pointer; the tooltip below is for the whole month.
      interaction: { mode: 'nearest', intersect: true },
      ...pickable((element) => {
        const category = report.categories[element.datasetIndex];
        const month = report.monthlyData[element.index]?.month;
        if (category && month && onPick) onPick(category, month);
      }, !!onPick),
      scales: {
        x: categoryAxis(theme, { stacked: true }),
        y: valueAxis(theme, { stacked: true }),
      },
      plugins: {
        legend: {
          ...legendStyle(theme),
          labels: {
            ...legendStyle(theme).labels,
            // Category entries plus an extra, non-toggleable "Avg" entry for the average line.
            generateLabels: (chart) => [
              ...Chart.defaults.plugins.legend.labels.generateLabels(chart),
              {
                text: `Avg: ${formatCurrency(visibleMonthlyAverage(chart, averaged))}`,
                fillStyle: theme.text,
                strokeStyle: theme.text,
                lineWidth: 2,
                pointStyle: 'line',
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
          ...tooltipStyle(theme),
          // The month at a glance: what was spent in each category, largest first, and the total.
          mode: 'index',
          intersect: false,
          itemSort: (a, b) => (b.raw as number) - (a.raw as number),
          filter: (item) => (item.raw as number) !== 0,
          callbacks: {
            label: (context) =>
              `${context.dataset.label}: ${formatCurrency(context.raw as number)}`,
            footer: (items) =>
              items.length > 1
                ? `Total: ${formatCurrency(items.reduce((sum, item) => sum + (item.raw as number), 0))}`
                : '',
          },
        },
        annotation: {
          annotations: {
            [AVERAGE_ANNOTATION_ID]: {
              type: 'line',
              borderDash: [5, 4],
              yMin: initialAverage,
              yMax: initialAverage,
              borderColor: theme.text,
              borderWidth: 1.5,
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
    chartPlugins: Plugin<'doughnut'>[];
  } {
    const categories = report.categories ?? [];
    const currentMonth = report.monthlyData[0]?.categoryValues ?? {};
    const amounts = categories.map((category) => currentMonth[category.name] || 0);

    const chartData: ChartData<'doughnut'> = {
      labels: categories.map((category) => category.name),
      datasets: [
        {
          data: amounts,
          backgroundColor: categories.map((category) => category.color),
          // Slices are parted by the surface, and rounded a little.
          borderColor: theme.surface,
          borderWidth: 3,
          borderRadius: 6,
          hoverOffset: 6,
        },
      ],
    };

    const chartOptions: ChartConfiguration<'doughnut'>['options'] = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '74%',
      animation: { ...ANIMATION, duration: 900 },
      layout: { padding: 8 },
      ...pickable((element) => {
        const category = categories[element.index];
        if (category && onPick) onPick(category);
      }, !!onPick),
      plugins: {
        // The dashboard lists categories with amounts right below the doughnut.
        legend: { display: false },
        tooltip: {
          ...tooltipStyle(theme),
          callbacks: {
            label: (context) => formatCurrency(context.raw as number),
          },
        },
      },
    };

    const chartPlugins = [
      centerLabel(
        theme,
        amounts.reduce((sum, amount) => sum + amount, 0),
        'this month',
      ),
    ];
    return { chartData, chartOptions, chartPlugins };
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
    const colors = cashFlowColors(theme);
    const marks = { ...BAR_MARKS, categoryPercentage: 0.75, barPercentage: 0.9 };
    const chartData: ChartData<'bar'> = {
      labels: months.map((month) => month.month),
      datasets: [
        {
          label: 'Income',
          data: months.map((month) => month.income),
          backgroundColor: colors.income,
          ...marks,
        },
        {
          label: 'Spending',
          data: months.map((month) => month.spending),
          backgroundColor: colors.spending,
          ...marks,
        },
        {
          label: 'Left over',
          data: months.map((month) => month.net),
          backgroundColor: colors.net,
          ...marks,
        },
      ],
    };
    if (hasSavingsChange(report)) {
      chartData.datasets.push({
        label: 'Savings change',
        data: months.map((month) => month.savingsChange),
        backgroundColor: colors.savings,
        ...marks,
      });
    }

    const chartOptions: ChartConfiguration<'bar'>['options'] = {
      responsive: true,
      maintainAspectRatio: false,
      animation: ANIMATION,
      layout: { padding: { top: 8, right: 4 } },
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: categoryAxis(theme),
        y: valueAxis(theme),
      },
      plugins: {
        legend: legendStyle(theme),
        tooltip: {
          ...tooltipStyle(theme),
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
