import { Chart } from 'chart.js';
import { formatCompactCurrency } from '../utils/format';
import { amountsHidden } from '../utils/privacy';

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
  // Hearth: warm inks on cream; the series are slate blue, terracotta, sage and plum.
  light: {
    text: '#5b524a',
    muted: '#7a6f64',
    strong: '#2b2622',
    grid: '#efe7dc',
    axis: '#d9cdbd',
    surface: '#fffdf9',
    tooltip: '#fffdf9',
    series: { blue: '#3f6f8f', orange: '#c2643c', aqua: '#5f8f5a', magenta: '#a35d84' },
  },
  dark: {
    text: '#d8cfc4',
    muted: '#a89c8f',
    strong: '#f5efe7',
    grid: '#352f29',
    axis: '#4a4239',
    surface: '#26211d',
    tooltip: '#312b26',
    series: { blue: '#6f9cbc', orange: '#e0805a', aqua: '#86b37f', magenta: '#c987ab' },
  },
};

/**
 * The colours for a mode, for a chart built in a computed. It reads privacy mode and comes back as a different object in
 * each state, so switching it rebuilds the chart: its ticks, tooltips and labels are formatted as it draws.
 */
export function chartTheme(mode: 'light' | 'dark'): ChartTheme {
  return amountsHidden() ? { ...CHART_THEMES[mode] } : CHART_THEMES[mode];
}

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
