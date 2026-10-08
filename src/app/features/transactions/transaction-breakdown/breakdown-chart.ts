import { ChartConfiguration, ChartData } from 'chart.js';
import {
  BAR_MARKS,
  ChartTheme,
  categoryAxis,
  tooltipStyle,
  valueAxis,
} from '../../../shared/charts/chart-helper';
import { formatCurrency } from '../../../shared/utils/format';
import {
  BreakdownPeriodDto,
  TransactionBreakdownOutputDto,
} from '../../../core/models/outputs/transaction-breakdown-output-dto';

/** Spending, unless the transactions are money in only (a salary, say): then what was received. */
export type BreakdownMeasure = 'spending' | 'income';

export function breakdownMeasure(breakdown: TransactionBreakdownOutputDto): BreakdownMeasure {
  return breakdown.spending === 0 && breakdown.income > 0 ? 'income' : 'spending';
}

/** The width both charts give their value axis, so their plots line up one above the other. */
const AXIS_WIDTH = 56;

/** `#rrggbb` as an rgba() colour: the wash under the running total's line. */
function withAlpha(hex: string, alpha: number): string {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) return hex;
  const [r, g, b] = match.slice(1).map((part) => parseInt(part, 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Two charts that share their periods, one above the other: bars for each period's amount, and under them the
 * running total. They are two because the total climbs to many times any one period: on one plot the bars would
 * sit in the corner, and a second scale for the line would invent a relation between the two. The tooltips show the
 * period. Clicking a bar hands its index to `onSelect`; the selected one keeps its colour and the others fade.
 */
export function breakdownChart(
  breakdown: TransactionBreakdownOutputDto,
  options: {
    theme: ChartTheme;
    /** The colour of both: the filtered category's, say. */
    color?: string | null;
    /** The selected bar's index, if any. */
    selected?: number | null;
    onSelect?: (index: number) => void;
  },
): {
  periods: { data: ChartData<'bar'>; options: ChartConfiguration<'bar'>['options'] };
  running: { data: ChartData<'line'>; options: ChartConfiguration<'line'>['options'] };
} {
  const { theme, onSelect } = options;
  const selected = options.selected ?? null;
  const measure = breakdownMeasure(breakdown);
  const color = options.color ?? (measure === 'income' ? theme.series.aqua : theme.series.blue);
  const periods = breakdown.periods;
  const amount = (p: BreakdownPeriodDto) => (measure === 'income' ? p.income : p.spending);
  const running = (p: BreakdownPeriodDto) =>
    measure === 'income' ? p.cumulativeIncome : p.cumulativeSpending;
  const labels = periods.map((p) => p.label);
  const title = (items: { dataIndex: number }[]) => periods[items[0]?.dataIndex ?? -1]?.label ?? '';
  const last = periods.length - 1;

  return {
    periods: {
      data: {
        labels,
        datasets: [
          {
            label: measure === 'income' ? 'Received' : 'Spent',
            data: periods.map(amount),
            backgroundColor:
              selected === null
                ? color
                : periods.map((_, i) => (i === selected ? color : withAlpha(color, 0.35))),
            ...BAR_MARKS,
            categoryPercentage: 0.8,
            barPercentage: 0.8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 8, right: 4 } },
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: categoryAxis(theme),
          y: valueAxis(theme, { width: AXIS_WIDTH }),
        },
        plugins: {
          // One series: the heading above the chart names it.
          legend: { display: false },
          tooltip: {
            ...tooltipStyle(theme),
            callbacks: {
              title,
              label: (context) =>
                `${context.dataset.label}: ${formatCurrency(context.raw as number)}`,
              footer: (items) => {
                const period = periods[items[0]?.dataIndex ?? -1];
                if (!period) return '';
                const noun = period.count === 1 ? 'transaction' : 'transactions';
                return onSelect
                  ? `${period.count} ${noun} · click for where it went`
                  : `${period.count} ${noun}`;
              },
            },
          },
        },
        onClick: (_event, elements) => {
          const index = elements[0]?.index ?? -1;
          if (periods[index] && onSelect) onSelect(index);
        },
        onHover: (event, elements) => {
          const target = event.native?.target as HTMLElement | undefined;
          if (target) target.style.cursor = elements.length > 0 && onSelect ? 'pointer' : 'default';
        },
      },
    },
    running: {
      data: {
        labels,
        datasets: [
          {
            label: 'Running total',
            data: periods.map(running),
            borderColor: color,
            borderWidth: 2,
            // A wash of the line's own colour under it.
            fill: true,
            backgroundColor: withAlpha(color, 0.12),
            tension: 0.3,
            // Only the latest point is marked, ringed in the surface; the others show on hover.
            pointRadius: (context) => (context.dataIndex === last ? 4 : 0),
            pointHoverRadius: 5,
            pointBackgroundColor: color,
            pointBorderColor: theme.surface,
            pointBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 8, right: 4 } },
        interaction: { mode: 'index', intersect: false },
        scales: {
          // The periods are labelled on the bars above.
          x: { ...categoryAxis(theme), ticks: { display: false } },
          y: { ...valueAxis(theme, { width: AXIS_WIDTH }), beginAtZero: true },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltipStyle(theme),
            callbacks: {
              title,
              label: (context) =>
                `${context.dataset.label}: ${formatCurrency(context.raw as number)}`,
            },
          },
        },
      },
    },
  };
}
