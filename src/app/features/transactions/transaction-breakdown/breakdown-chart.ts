import { ChartConfiguration, ChartData } from 'chart.js';
import { ChartTheme, formatCurrency } from '../../dashboard/chart-helper';
import {
  BreakdownPeriodDto,
  TransactionBreakdownOutputDto,
} from '../../../core/models/outputs/transaction-breakdown-output-dto';

/** Spending, unless the transactions are money in only (a salary, say): then what was received. */
export type BreakdownMeasure = 'spending' | 'income';

export function breakdownMeasure(breakdown: TransactionBreakdownOutputDto): BreakdownMeasure {
  return breakdown.spending === 0 && breakdown.income > 0 ? 'income' : 'spending';
}

export const BREAKDOWN_COLORS = {
  /** The theme's primary colour, when no category gives one. */
  bars: '#4f46e5',
  income: '#16a34a',
  runningTotal: '#94a3b8',
} as const;

/**
 * Bars for each period's amount and a line for the running total (on its own scale, at the right), with the tooltip
 * showing both. Clicking a bar hands its period to `onPick`.
 */
export function breakdownChart(
  breakdown: TransactionBreakdownOutputDto,
  options: {
    theme: ChartTheme;
    /** The bars' colour: the filtered category's, say. */
    color?: string | null;
    onPick?: (period: BreakdownPeriodDto) => void;
  },
): {
  data: ChartData<'bar' | 'line'>;
  options: ChartConfiguration<'bar' | 'line'>['options'];
} {
  const { theme, color, onPick } = options;
  const measure = breakdownMeasure(breakdown);
  const periods = breakdown.periods;
  const amount = (p: BreakdownPeriodDto) => (measure === 'income' ? p.income : p.spending);
  const running = (p: BreakdownPeriodDto) =>
    measure === 'income' ? p.cumulativeIncome : p.cumulativeSpending;

  const data: ChartData<'bar' | 'line'> = {
    labels: periods.map((p) => p.label),
    datasets: [
      {
        type: 'bar',
        label: measure === 'income' ? 'Received' : 'Spent',
        data: periods.map(amount),
        backgroundColor:
          color ?? (measure === 'income' ? BREAKDOWN_COLORS.income : BREAKDOWN_COLORS.bars),
        borderRadius: 3,
        yAxisID: 'y',
        order: 2,
      },
      {
        type: 'line',
        label: 'Running total',
        data: periods.map(running),
        borderColor: BREAKDOWN_COLORS.runningTotal,
        backgroundColor: BREAKDOWN_COLORS.runningTotal,
        borderWidth: 2,
        pointRadius: periods.length > 40 ? 0 : 2,
        tension: 0.2,
        yAxisID: 'running',
        order: 1,
      },
    ],
  };

  return {
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          ticks: { color: theme.text, autoSkip: true, maxRotation: 0 },
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: { color: theme.text, callback: (value) => formatCurrency(Number(value)) },
          grid: { color: theme.grid },
        },
        running: {
          position: 'right',
          beginAtZero: true,
          ticks: { color: theme.text, callback: (value) => formatCurrency(Number(value)) },
          grid: { display: false },
        },
      },
      plugins: {
        legend: { position: 'bottom', align: 'start', labels: { color: theme.text } },
        tooltip: {
          callbacks: {
            label: (context) =>
              `${context.dataset.label}: ${formatCurrency(context.raw as number)}`,
            footer: (items) => {
              const period = periods[items[0]?.dataIndex ?? -1];
              if (!period) return '';
              const noun = period.count === 1 ? 'transaction' : 'transactions';
              return onPick
                ? `${period.count} ${noun} · click to list them`
                : `${period.count} ${noun}`;
            },
          },
        },
      },
      onClick: (_event, elements) => {
        const period = periods[elements[0]?.index ?? -1];
        if (period && onPick) onPick(period);
      },
      onHover: (event, elements) => {
        const target = event.native?.target as HTMLElement | undefined;
        if (target) target.style.cursor = elements.length > 0 && onPick ? 'pointer' : 'default';
      },
    },
  };
}
