import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CurrencyPipe } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import { ThemeService } from '../../../core/theme/theme.service';
import { ReportsRepository } from '../../../core/api/reports-repository';
import { TransactionCriteriaInputDto } from '../../../core/models/inputs/transaction-breakdown-input-dto';
import {
  BreakdownInterval,
  BreakdownPeriodDto,
  MerchantTotalDto,
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
  Filler,
  Tooltip,
  Legend,
);

/** As many as the breakdown's top merchants, so each page follows on from them. */
export const MERCHANTS_PAGE_SIZE = 8;

const UNITS: Record<BreakdownInterval, [string, string]> = {
  Week: ['week', 'weeks'],
  Month: ['month', 'months'],
  Quarter: ['quarter', 'quarters'],
  Year: ['year', 'years'],
};

/**
 * Totals for the transactions the list's filters pick, and, when opened, how they spread over weeks, months, quarters
 * or years: bars per period with the running total, the average and the biggest period, and the merchants the
 * spending went to. The page loads the numbers; more merchants load here, a page at a time.
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
    }
    .chart-periods {
      height: 14rem;
    }
    .chart-running {
      height: 7.5rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionBreakdownComponent {
  private readonly theme = inject(ThemeService);
  private readonly reports = inject(ReportsRepository);
  private readonly destroyRef = inject(DestroyRef);

  readonly breakdown = input<TransactionBreakdownOutputDto | undefined>();
  readonly loading = input(false);
  readonly failed = input(false);
  readonly open = input(false);
  readonly interval = input<BreakdownInterval>('Month');
  /** The bars' colour: the filtered category's, when there is one. */
  readonly color = input<string | null>(null);
  /** What the breakdown is of, to load more of its merchants. */
  readonly criteria = input<TransactionCriteriaInputDto | undefined>();

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
    // Nothing matched: an average of nothing over empty periods says nothing.
    if (!breakdown || breakdown.periods.length === 0 || breakdown.count === 0) return null;
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

  /** Merchants loaded after the top ones; a new breakdown starts over. */
  private readonly moreMerchants = linkedSignal<
    TransactionBreakdownOutputDto | undefined,
    MerchantTotalDto[]
  >({
    source: this.breakdown,
    computation: () => [],
  });
  readonly loadingMore = signal(false);
  readonly moreFailed = signal(false);

  /** Where the spending went, when it went to more than one place. */
  readonly merchants = computed(() => {
    const merchants = [...(this.breakdown()?.topMerchants ?? []), ...this.moreMerchants()];
    // Largest first, so the bars are relative to the top one.
    const max = Math.max(0, ...merchants.map((m) => m.spending));
    return merchants.length > 1
      ? merchants.map((m) => ({ ...m, percent: max > 0 ? (m.spending / max) * 100 : 0 }))
      : [];
  });

  /** How many merchants there are, and how many the next page adds. */
  readonly merchantsLeft = computed(() => {
    const total = this.breakdown()?.merchantCount ?? 0;
    const shown = this.merchants().length;
    return shown > 0 && shown < total
      ? { shown, total, next: Math.min(MERCHANTS_PAGE_SIZE, total - shown) }
      : null;
  });

  loadMoreMerchants(): void {
    const criteria = this.criteria();
    if (!criteria || this.loadingMore()) return;
    const breakdown = this.breakdown();
    this.loadingMore.set(true);
    this.moreFailed.set(false);
    this.reports
      .getMerchants({
        ...criteria,
        page: this.merchants().length / MERCHANTS_PAGE_SIZE + 1,
        pageSize: MERCHANTS_PAGE_SIZE,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.loadingMore.set(false);
          // The filters changed while it loaded: these are another list's.
          if (this.breakdown() !== breakdown) return;
          this.moreMerchants.update((more) => [...more, ...page.items]);
        },
        error: () => {
          this.loadingMore.set(false);
          this.moreFailed.set(true);
        },
      });
  }

  showFewerMerchants(): void {
    this.moreMerchants.set([]);
    this.moreFailed.set(false);
  }

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
