import { ChartEvent } from 'chart.js';
import { breakdownChart, breakdownMeasure, BREAKDOWN_COLORS } from './breakdown-chart';
import { CHART_THEMES } from '../../dashboard/chart-helper';
import { BreakdownPeriodDto } from '../../../core/models/outputs/transaction-breakdown-output-dto';
import { TEST_BREAKDOWN } from '../../../testing/test-breakdown';

describe('breakdownChart', () => {
  it('draws each period as a bar and the running total as a line on its own scale', () => {
    const { data } = breakdownChart(TEST_BREAKDOWN, { theme: CHART_THEMES.light });

    expect(data.labels).toEqual(['Jul 2026', 'Aug 2026', 'Sep 2026']);
    const [bars, line] = data.datasets;
    expect([bars.type, bars.label, bars.data, bars.backgroundColor]).toEqual([
      'bar',
      'Spent',
      [120, 0, 70],
      BREAKDOWN_COLORS.bars,
    ]);
    expect([line.type, line.data, line.yAxisID]).toEqual(['line', [120, 120, 190], 'running']);
  });

  it("uses the filtered category's colour for the bars", () => {
    const { data } = breakdownChart(TEST_BREAKDOWN, {
      theme: CHART_THEMES.light,
      color: '#2CA12D',
    });

    expect(data.datasets[0].backgroundColor).toBe('#2CA12D');
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

    const { data } = breakdownChart(salary, { theme: CHART_THEMES.light });

    expect(breakdownMeasure(salary)).toBe('income');
    expect([data.datasets[0].label, data.datasets[0].data]).toEqual([
      'Received',
      [3000, 3000, 3000],
    ]);
  });

  it('hands the clicked bar’s period on', () => {
    const picked: BreakdownPeriodDto[] = [];
    const { options } = breakdownChart(TEST_BREAKDOWN, {
      theme: CHART_THEMES.light,
      onPick: (period) => picked.push(period),
    });

    const onClick = options!.onClick as (event: ChartEvent, elements: { index: number }[]) => void;
    onClick({} as ChartEvent, [{ index: 2 }]);
    onClick({} as ChartEvent, []);

    expect(picked.map((p) => p.label)).toEqual(['Sep 2026']);
  });
});
