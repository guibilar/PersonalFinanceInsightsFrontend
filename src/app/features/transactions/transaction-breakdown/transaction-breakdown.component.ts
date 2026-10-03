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
import { Subscription } from 'rxjs';
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
 * spending went to (a clicked bar's, or the whole range's). The page loads the numbers; more merchants load here, a page at a time.
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
  /** "Show these" under a selected bar: list that period's transactions. */
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

  /**
   * The bar clicked (an index into the periods): "Where it went" is then that period's. Clicked again, it clears; a
   * new breakdown has new periods, so it clears too.
   */
  readonly selected = linkedSignal<TransactionBreakdownOutputDto | undefined, number | null>({
    source: this.breakdown,
    computation: () => null,
  });
  readonly period = computed(() => {
    const index = this.selected();
    return index === null ? null : (this.breakdown()?.periods[index] ?? null);
  });

  /** Merchants loaded after the top ones; a new breakdown starts over. */
  private readonly moreMerchants = linkedSignal<
    TransactionBreakdownOutputDto | undefined,
    MerchantTotalDto[]
  >({
    source: this.breakdown,
    computation: () => [],
  });
  /** The selected period's merchants, a page at a time, and how many it has; another period starts over. */
  private readonly periodMerchants = linkedSignal<BreakdownPeriodDto | null, MerchantTotalDto[]>({
    source: this.period,
    computation: () => [],
  });
  private readonly periodMerchantCount = linkedSignal<BreakdownPeriodDto | null, number>({
    source: this.period,
    computation: () => 0,
  });
  readonly loadingMore = signal(false);
  readonly moreFailed = signal(false);
  private request?: Subscription;

  /** Where the spending went: the selected period's, or, when it went to more than one place, the whole range's. */
  readonly merchants = computed(() => {
    const period = this.period();
    const merchants = period
      ? this.periodMerchants()
      : [...(this.breakdown()?.topMerchants ?? []), ...this.moreMerchants()];
    // Largest first, so the bars are relative to the top one.
    const max = Math.max(0, ...merchants.map((m) => m.spending));
    return period || merchants.length > 1
      ? merchants.map((m) => ({ ...m, percent: max > 0 ? (m.spending / max) * 100 : 0 }))
      : [];
  });

  /** How many merchants there are, and how many the next page adds. */
  readonly merchantsLeft = computed(() => {
    const total = this.period()
      ? this.periodMerchantCount()
      : (this.breakdown()?.merchantCount ?? 0);
    const shown = this.merchants().length;
    return shown > 0 && shown < total
      ? { shown, total, next: Math.min(MERCHANTS_PAGE_SIZE, total - shown) }
      : null;
  });

  /** More than the first page is shown: it can go back to that. */
  readonly canShowFewer = computed(() =>
    this.period()
      ? this.periodMerchants().length > MERCHANTS_PAGE_SIZE
      : this.moreMerchants().length > 0,
  );

  /** A bar clicked: that period's merchants, or (the same bar again) back to the whole range's. */
  select(index: number): void {
    this.request?.unsubscribe();
    this.loadingMore.set(false);
    this.moreFailed.set(false);
    this.selected.set(this.selected() === index ? null : index);
    // Money in only, there is no spending to say where it went.
    if (this.period() && this.measure() === 'spending') this.loadMoreMerchants();
  }

  loadMoreMerchants(): void {
    const criteria = this.criteria();
    if (!criteria || this.loadingMore()) return;
    const breakdown = this.breakdown();
    const period = this.period();
    const shown = period ? this.periodMerchants().length : this.merchants().length;
    this.loadingMore.set(true);
    this.moreFailed.set(false);
    this.request = this.reports
      .getMerchants({
        ...criteria,
        ...(period && { startDate: period.start.slice(0, 10), endDate: period.end.slice(0, 10) }),
        page: shown / MERCHANTS_PAGE_SIZE + 1,
        pageSize: MERCHANTS_PAGE_SIZE,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.loadingMore.set(false);
          // The filters or the selected bar changed while it loaded: these are another list's.
          if (this.breakdown() !== breakdown || this.period() !== period) return;
          if (period) {
            this.periodMerchants.update((merchants) => [...merchants, ...page.items]);
            this.periodMerchantCount.set(page.totalCount);
          } else {
            this.moreMerchants.update((more) => [...more, ...page.items]);
          }
        },
        error: () => {
          this.loadingMore.set(false);
          this.moreFailed.set(true);
        },
      });
  }

  showFewerMerchants(): void {
    this.moreMerchants.set([]);
    this.periodMerchants.update((merchants) => merchants.slice(0, MERCHANTS_PAGE_SIZE));
    this.moreFailed.set(false);
  }

  readonly chart = computed(() => {
    const breakdown = this.breakdown();
    return breakdown
      ? breakdownChart(breakdown, {
          theme: CHART_THEMES[this.theme.theme()],
          color: this.color(),
          selected: this.selected(),
          onSelect: (index) => this.select(index),
        })
      : null;
  });
}
