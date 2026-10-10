import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReportsRepository } from '../../core/api/reports-repository';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { StatCardComponent } from '../../shared/ui/stat-card/stat-card.component';
import { keptValueOf } from '../../shared/utils/resource-value';
import { DataChangesService } from '../../core/data/data-changes.service';
import { changeText, compared, shortDay, stepReview } from '../../shared/utils/insights';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { formatCurrency } from '../../shared/utils/format';

/** Which period a review is of: a month, or a year (month null). Undefined: the last complete month. */
interface ReviewPeriod {
  year: number;
  month: number | null;
}

/**
 * A month or a year looked back on: what went out and came in against the period before, the categories that moved
 * most, where the most went, the biggest purchase, and (for a year) each month. ?year=2026&month=9 opens a month,
 * ?year=2026 a year.
 */
@Component({
  selector: 'app-review',
  imports: [
    MoneyPipe,
    RouterLink,
    ErrorStateComponent,
    IconComponent,
    SkeletonComponent,
    StatCardComponent,
  ],
  templateUrl: './review.component.html',
  styles: `
    .bar {
      height: 0.5rem;
      border-radius: 1rem;
      background: var(--bs-primary);
    }
    .bar-track {
      background: var(--bs-secondary-bg);
      border-radius: 1rem;
    }
    .month-bar {
      height: 8rem;
      display: flex;
      align-items: flex-end;
    }
    .month-bar > div {
      width: 100%;
      border-radius: 0.375rem 0.375rem 0 0;
      background: var(--bs-primary);
      min-height: 2px;
    }
    .category-dot {
      display: inline-block;
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 50%;
      margin-right: 0.375rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewComponent {
  private readonly reports = inject(ReportsRepository);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly today = new Date();
  readonly period = signal<ReviewPeriod | undefined>(fromQuery(this.route.snapshot.queryParamMap));

  /** A statement imported from the sidebar loads the review again. */
  private readonly dataChanges = inject(DataChangesService);

  readonly review = rxResource({
    params: () => ({ period: this.period(), version: this.dataChanges.version() }),
    stream: ({ params }) =>
      this.reports.getReview(params.period?.year, params.period?.month ?? undefined),
  });
  // Kept while the next period loads, so the month switcher (and its focus) stays put.
  readonly value = keptValueOf(this.review);

  readonly isYear = computed(() => this.value()?.month === null);

  readonly spendingChange = computed(() => {
    const review = this.value();
    return review ? changeText(review.spending, review.previousSpending) : null;
  });

  /** The categories that moved most, either way: up to three each. */
  readonly movers = computed(() => {
    const categories = this.value()?.categories ?? [];
    const withChange = categories
      .map((c) => ({ ...c, change: c.spending - c.previousSpending }))
      .filter((c) => Math.abs(c.change) >= 1);
    return {
      up: withChange
        .filter((c) => c.change > 0)
        .sort((a, b) => b.change - a.change)
        .slice(0, 3),
      down: withChange
        .filter((c) => c.change < 0)
        .sort((a, b) => a.change - b.change)
        .slice(0, 3),
    };
  });

  readonly categoryMax = computed(() =>
    Math.max(
      1,
      ...(this.value()?.categories ?? []).map((c) => Math.max(c.spending, c.previousSpending)),
    ),
  );
  readonly monthMax = computed(() =>
    Math.max(1, ...(this.value()?.months ?? []).map((m) => m.spending)),
  );

  readonly previous = computed(() => this.step(-1));
  readonly next = computed(() => this.step(1));

  protected readonly day = shortDay;
  protected readonly compare = compared;

  constructor() {
    // A link to the page while it is open (the menu's plain one) shows the period it names.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((query) => {
      const period = fromQuery(query);
      if (!samePeriod(period, this.period())) this.period.set(period);
    });
  }

  format(amount: number): string {
    return formatCurrency(amount);
  }

  /** "Left over $1,685.00", or "$573.61 more went out than came in". */
  leftOver(net: number): string {
    return net >= 0
      ? `Left over ${this.format(net)}`
      : `${this.format(-net)} more went out than came in`;
  }

  /** The other kind of review over the same time: this month's year, or that year's last month there is. */
  switchTo(kind: 'month' | 'year'): void {
    const review = this.value();
    if (!review) return;
    if (kind === 'year') {
      this.go({ year: review.year, month: null });
    } else {
      const now = this.today;
      const month = review.year === now.getFullYear() ? now.getMonth() + 1 : 12;
      this.go({ year: review.year, month });
    }
  }

  /** The review the page opens on: the month so far. */
  latest(): void {
    this.period.set(undefined);
    void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
  }

  go(period: ReviewPeriod | null): void {
    if (!period) return;
    this.period.set(period);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { year: period.year, month: period.month ?? undefined },
      replaceUrl: true,
    });
  }

  private step(step: 1 | -1): ReviewPeriod | null {
    const review = this.value();
    return review ? stepReview(review.year, review.month, step, this.today, review.earliest) : null;
  }
}

function fromQuery(query: ParamMap): ReviewPeriod | undefined {
  const year = Number(query.get('year'));
  if (!Number.isInteger(year) || year < 2000) return undefined;
  const month = Number(query.get('month'));
  return { year, month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : null };
}

function samePeriod(a: ReviewPeriod | undefined, b: ReviewPeriod | undefined): boolean {
  return a?.year === b?.year && a?.month === b?.month;
}
