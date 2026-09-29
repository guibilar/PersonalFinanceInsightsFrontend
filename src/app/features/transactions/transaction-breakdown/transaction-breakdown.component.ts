import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import { ThemeService } from '../../../core/theme/theme.service';
import {
  BreakdownInterval,
  BreakdownPeriodDto,
  TransactionBreakdownOutputDto,
} from '../../../core/models/outputs/transaction-breakdown-output-dto';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { CHART_THEMES } from '../../dashboard/chart-helper';
import { breakdownChart, breakdownMeasure } from './breakdown-chart';

// Registered here so Chart.js ships with the transactions page only when it is used; registering twice is harmless.
Chart.register(
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
);

const UNITS: Record<BreakdownInterval, [string, string]> = {
  Week: ['week', 'weeks'],
  Month: ['month', 'months'],
  Quarter: ['quarter', 'quarters'],
  Year: ['year', 'years'],
};

/**
 * Totals for the transactions the list's filters pick, and, when opened, how they spread over weeks, months, quarters
 * or years: bars per period with the running total, the average and the biggest period, and the merchants the
 * spending went to. The page loads the numbers.
 */
@Component({
  selector: 'app-transaction-breakdown',
  imports: [BaseChartDirective, CurrencyPipe, IconComponent],
  templateUrl: './transaction-breakdown.component.html',
  styles: `
    .merchant-bar {
      height: 0.375rem;
    }
    .chart-container {
      position: relative;
      width: 100%;
      height: 16rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionBreakdownComponent {
  private readonly theme = inject(ThemeService);

  readonly breakdown = input<TransactionBreakdownOutputDto | undefined>();
  readonly loading = input(false);
  readonly failed = input(false);
  readonly open = input(false);
  readonly interval = input<BreakdownInterval>('Month');
  /** The bars' colour: the filtered category's, when there is one. */
  readonly color = input<string | null>(null);

  readonly openChange = output<boolean>();
  readonly intervalChange = output<BreakdownInterval>();
  /** A bar was clicked: list that period's transactions. */
  readonly periodPicked = output<BreakdownPeriodDto>();
  readonly retry = output<void>();

  readonly intervals: BreakdownInterval[] = ['Week', 'Month', 'Quarter', 'Year'];

  readonly measure = computed(() => {
    const breakdown = this.breakdown();
    return breakdown ? breakdownMeasure(breakdown) : 'spending';
  });

  readonly unit = computed(() => UNITS[this.breakdown()?.interval ?? this.interval()]);

  readonly average = computed(() => {
    const breakdown = this.breakdown();
    if (!breakdown || breakdown.periods.length === 0) return null;
    const amount =
      this.measure() === 'income' ? breakdown.averageIncome : breakdown.averageSpending;
    const [one, many] = this.unit();
    return {
      amount,
      per: one,
      over: `${breakdown.averagedPeriods} ${breakdown.averagedPeriods === 1 ? one : many}`,
    };
  });

  /** The period with the most spent (or received). */
  readonly highest = computed(() => {
    const periods = this.breakdown()?.periods ?? [];
    const amount = (p: BreakdownPeriodDto) => (this.measure() === 'income' ? p.income : p.spending);
    const top = periods.reduce<BreakdownPeriodDto | null>(
      (best, p) => (best === null || amount(p) > amount(best) ? p : best),
      null,
    );
    return top && amount(top) > 0 ? { label: top.label, amount: amount(top) } : null;
  });

  /** Where the spending went, when it went to more than one place. */
  readonly merchants = computed(() => {
    const merchants = this.breakdown()?.topMerchants ?? [];
    const max = Math.max(0, ...merchants.map((m) => m.spending));
    return merchants.length > 1
      ? merchants.map((m) => ({ ...m, percent: max > 0 ? (m.spending / max) * 100 : 0 }))
      : [];
  });

  readonly chart = computed(() => {
    const breakdown = this.breakdown();
    return breakdown
      ? breakdownChart(breakdown, {
          theme: CHART_THEMES[this.theme.theme()],
          color: this.color(),
          onPick: (period) => this.periodPicked.emit(period),
        })
      : null;
  });
}
