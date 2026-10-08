import { ChartEvent } from 'chart.js';
import { breakdownChart, breakdownMeasure } from './breakdown-chart';
import { CHART_THEMES } from '../../../shared/charts/chart-theme';
import { TEST_BREAKDOWN } from '../../../testing/test-breakdown';

const theme = CHART_THEMES.light;

describe('breakdownChart', () => {
  it('draws each period as a bar, and the running total as a line in a chart of its own', () => {
    const { periods, running } = breakdownChart(TEST_BREAKDOWN, { theme });

    expect(periods.data.labels).toEqual(['Jul 2026', 'Aug 2026', 'Sep 2026']);
    const [bars] = periods.data.datasets;
    expect([bars.label, bars.data, bars.backgroundColor]).toEqual([
      'Spent',
      [120, 0, 70],
      theme.series.blue,
    ]);
    expect(running.data.labels).toEqual(periods.data.labels);
    const [line] = running.data.datasets;
    expect([line.label, line.data, line.borderColor]).toEqual([
      'Running total',
      [120, 120, 190],
      theme.series.blue,
    ]);
  });

  it('has no second scale: each chart has one value axis', () => {
    const { periods, running } = breakdownChart(TEST_BREAKDOWN, { theme });

    expect(Object.keys(periods.options!.scales!)).toEqual(['x', 'y']);
    expect(Object.keys(running.options!.scales!)).toEqual(['x', 'y']);
    // The same width, so the two plots line up one above the other.
    const width = (options: typeof periods.options) => {
      const axis = { width: 0 };
      (options!.scales!['y'] as { afterFit: (axis: { width: number }) => void }).afterFit(axis);
      return axis.width;
    };
    expect(width(periods.options)).toBe(width(running.options as typeof periods.options));
  });

  it("uses the filtered category's colour for both, with a wash of it under the line", () => {
    const { periods, running } = breakdownChart(TEST_BREAKDOWN, { theme, color: '#2CA12D' });

    expect(periods.data.datasets[0].backgroundColor).toBe('#2CA12D');
    const [line] = running.data.datasets;
    expect([line.borderColor, line.backgroundColor, line.fill]).toEqual([
      '#2CA12D',
      'rgba(44, 161, 45, 0.12)',
      true,
    ]);
  });

  it('marks only the latest point of the running total', () => {
    const { running } = breakdownChart(TEST_BREAKDOWN, { theme });
    const radius = running.data.datasets[0].pointRadius as (context: {
      dataIndex: number;
    }) => number;

    expect([0, 1, 2].map((dataIndex) => radius({ dataIndex }))).toEqual([0, 0, 4]);
  });

  it('shows money received when there is no spending at all, a salary say', () => {
    const salary = {
      ...TEST_BREAKDOWN,
      spending: 0,
      income: 6000,
      periods: TEST_BREAKDOWN.periods.map((p) => ({
        ...p,
        spending: 0,
        cumulativeSpending: 0,
        income: 3000,
        cumulativeIncome: 3000,
      })),
    };

    const { periods } = breakdownChart(salary, { theme });

    expect(breakdownMeasure(salary)).toBe('income');
    expect([
      periods.data.datasets[0].label,
      periods.data.datasets[0].data,
      periods.data.datasets[0].backgroundColor,
    ]).toEqual(['Received', [3000, 3000, 3000], theme.series.aqua]);
  });

  it('names the period and counts its transactions in the tooltip', () => {
    const { periods } = breakdownChart(TEST_BREAKDOWN, { theme, onSelect: () => undefined });
    const callbacks = periods.options!.plugins!.tooltip!.callbacks as unknown as {
      title: (items: unknown[]) => string;
      footer: (items: unknown[]) => string;
    };

    expect(callbacks.title([{ dataIndex: 2 }])).toBe('Sep 2026');
    expect(callbacks.footer([{ dataIndex: 2 }])).toMatch(
      /transactions? · click for where it went$/,
    );
  });

  it('hands the clicked bar’s index on', () => {
    const selected: number[] = [];
    const { periods } = breakdownChart(TEST_BREAKDOWN, {
      theme,
      onSelect: (index) => selected.push(index),
    });

    const onClick = periods.options!.onClick as (
      event: ChartEvent,
      elements: { index: number }[],
    ) => void;
    onClick({} as ChartEvent, [{ index: 2 }]);
    onClick({} as ChartEvent, []);

    expect(selected).toEqual([2]);
  });

  it('keeps the selected bar’s colour and fades the others', () => {
    const { periods } = breakdownChart(TEST_BREAKDOWN, { theme, color: '#1F76B5', selected: 2 });
    const colors = periods.data.datasets[0].backgroundColor as string[];

    expect(colors[2]).toBe('#1F76B5');
    expect(colors[0]).toBe('rgba(31, 118, 181, 0.35)');
    expect(colors[1]).toBe('rgba(31, 118, 181, 0.35)');
  });
});
