import { Chart } from 'chart.js';
import { formatCompactCurrency } from '../utils/format';

// The app's own typeface, so the charts don't fall back to the browser's.
export const FONT_FAMILY =
  "'Inter Variable', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
Chart.defaults.font.family = FONT_FAMILY;
Chart.defaults.font.size = 12;

/** Colours that depend on light/dark mode. */
export interface ChartTheme {
  /** Axis text and legend labels. */
  text: string;
  /** Tick labels and captions: the quietest ink. */
  muted: string;
  /** Titles and the figure in a doughnut. */
  strong: string;
  /** Hairline gridlines. */
  grid: string;
  /** The zero line. */
  axis: string;
  /** Surface behind the chart: it separates touching marks (a stack's gaps, a doughnut's slices). */
  surface: string;
  /** The tooltip card. */
  tooltip: string;
  /**
   * The colours the charts pick themselves (the user's categories bring their own): the first slots of the
   * categorical palette, stepped for each mode and checked against its surface.
   */
  series: { blue: string; orange: string; aqua: string; magenta: string };
}

export const CHART_THEMES: Record<'light' | 'dark', ChartTheme> = {
  light: {
    text: '#4b5563',
    muted: '#6b7280',
    strong: '#111827',
    grid: '#e9ecf2',
    axis: '#c9cfdb',
    surface: '#ffffff',
    tooltip: '#ffffff',
    series: { blue: '#2a78d6', orange: '#eb6834', aqua: '#1baf7a', magenta: '#e87ba4' },
  },
  dark: {
    text: '#cbd5e1',
    muted: '#94a3b8',
    strong: '#f1f5f9',
    grid: '#262d3b',
    axis: '#3b4558',
    surface: '#171b24',
    tooltip: '#212836',
    series: { blue: '#3987e5', orange: '#d95926', aqua: '#199e70', magenta: '#d55181' },
  },
};

/** The bars of the income and spending chart: each figure keeps its colour whatever else is shown. */
export function cashFlowColors(theme: ChartTheme) {
  return {
    income: theme.series.aqua,
    spending: theme.series.orange,
    net: theme.series.blue,
    savings: theme.series.magenta,
  };
}

/** The value axis: a hairline grid and nothing else, compact ticks, a stronger line at zero. */
export function valueAxis(theme: ChartTheme, options: { stacked?: boolean; width?: number } = {}) {
  return {
    stacked: options.stacked,
    border: { display: false },
    grid: {
      color: (context: { tick?: { value: number } }) =>
        context.tick?.value === 0 ? theme.axis : theme.grid,
      lineWidth: 1,
      drawTicks: false,
    },
    ticks: {
      color: theme.muted,
      padding: 10,
      maxTicksLimit: 6,
      callback: (value: string | number) => formatCompactCurrency(Number(value)),
    },
    // Charts that sit above each other get the same width, so their plots line up.
    afterFit: options.width
      ? (axis: { width: number }) => {
          axis.width = options.width!;
        }
      : undefined,
  };
}

/** The category axis: labels only, no rules. */
export function categoryAxis(theme: ChartTheme, options: { stacked?: boolean } = {}) {
  return {
    stacked: options.stacked,
    border: { display: false },
    grid: { display: false },
    ticks: { color: theme.muted, padding: 6, maxRotation: 0, autoSkip: true },
  };
}

/** Round swatches, quiet text. */
export function legendStyle(theme: ChartTheme) {
  return {
    position: 'bottom' as const,
    align: 'start' as const,
    labels: {
      color: theme.text,
      usePointStyle: true,
      pointStyle: 'circle' as const,
      boxWidth: 8,
      boxHeight: 8,
      padding: 16,
    },
  };
}

/** A card in the chart's surface with a hairline, and a round swatch for each series. */
export function tooltipStyle(theme: ChartTheme) {
  return {
    backgroundColor: theme.tooltip,
    borderColor: theme.grid,
    borderWidth: 1,
    titleColor: theme.strong,
    bodyColor: theme.text,
    footerColor: theme.muted,
    titleFont: { weight: 600 },
    footerFont: { weight: 'normal' as const },
    cornerRadius: 10,
    padding: 12,
    boxPadding: 6,
    caretSize: 0,
    usePointStyle: true,
  };
}

/** Bars are thin and rounded at the end that shows the value, square where they stand on the baseline. */
export const BAR_MARKS = {
  borderRadius: 4,
  borderSkipped: 'start',
  maxBarThickness: 24,
} as const;

export const ANIMATION = { duration: 700, easing: 'easeOutQuart' } as const;
