import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { ReportsRepository } from '../../core/api/reports-repository';
import { BudgetRepository } from '../../core/api/budget-repository';
import { TransactionRepository } from '../../core/api/transaction-repository';
import { Status } from '../../core/models/enums/status';
import { CardWrapperComponent } from '../../shared/ui/card-wrapper/card-wrapper.component';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { IconComponent, IconName } from '../../shared/ui/icon/icon.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { StatCardComponent, StatTone } from '../../shared/ui/stat-card/stat-card.component';
import { MonthlyCategorizedChartComponent } from './monthly-categorized-chart/monthly-categorized-chart.component';
import { CategoryBreakdownComponent } from './category-breakdown/category-breakdown.component';
import { BudgetOverviewComponent } from './budget-overview/budget-overview.component';
import { RecentTransactionsComponent } from './recent-transactions/recent-transactions.component';
import { CategoryAveragesComponent } from './category-averages/category-averages.component';
import { CashFlowComponent } from './cash-flow/cash-flow.component';
import { MonthForecastComponent } from './month-forecast/month-forecast.component';
import {
  budgetsOverLimit,
  leftOverThisMonth,
  usualByNow,
  netWorthChange,
  percentChange,
  previousMonthToDateLabel,
  spentThisMonth,
} from './dashboard-stats';
import { AttentionKind, attentionItems } from './attention';
import { investments } from './investments';
import { AccountRepository } from '../../core/api/account-repository';
import { DataChangesService } from '../../core/data/data-changes.service';
import { PLAN_LABELS } from '../../shared/utils/account-labels';
import { valueOf } from '../../shared/utils/resource-value';
import { anyMonthFinished } from '../../shared/utils/months';
import { formatDay, formatCurrency } from '../../shared/utils/format';

// Registered here so Chart.js only ships in the lazily loaded dashboard chunk.
Chart.register(
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  ArcElement,
  DoughnutController,
  Tooltip,
  Legend,
  annotationPlugin,
);

const RECENT_TRANSACTIONS = 6;

@Component({
  selector: 'app-dashboard',
  imports: [
    RouterLink,
    CardWrapperComponent,
    ErrorStateComponent,
    IconComponent,
    SkeletonComponent,
    StatCardComponent,
    MonthlyCategorizedChartComponent,
    CategoryBreakdownComponent,
    CategoryAveragesComponent,
    BudgetOverviewComponent,
    RecentTransactionsComponent,
    CashFlowComponent,
    MonthForecastComponent,
  ],
  templateUrl: './dashboard.component.html',
  styles: `
    // A headline number that opens its page: the whole tile is the link.
    .stat-link {
      display: block;
      height: 100%;
      color: inherit;
      text-decoration: none;
      border-radius: var(--bs-card-border-radius);

      &:hover ::ng-deep .card {
        border-color: var(--bs-primary-border-subtle);
      }

      &:focus-visible {
        outline: 2px solid var(--bs-primary);
        outline-offset: 2px;
      }
    }

    .attention {
      border-color: var(--bs-warning-border-subtle);
      background: var(--bs-warning-bg-subtle);
    }

    .attention-icon {
      display: inline-flex;
      flex-shrink: 0;
      padding: 0.3rem;
      border-radius: 50%;
      background: var(--bs-body-bg);
      color: var(--bs-warning-text-emphasis);

      &[data-kind='budget'] {
        color: var(--bs-danger-text-emphasis);
      }
    }

    .attention-link {
      color: var(--bs-emphasis-color);
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private readonly reportsRepository = inject(ReportsRepository);
  private readonly budgetRepository = inject(BudgetRepository);
  private readonly transactionRepository = inject(TransactionRepository);
  private readonly accountRepository = inject(AccountRepository);
  /** A statement imported from the sidebar reloads everything below. */
  private readonly dataChanges = inject(DataChangesService);

  /**
   * Read again with the data: the reports follow the server's month, so a page left open into the next one shows the
   * new month's figures against the new month's date, not the day it was opened.
   */
  readonly today = computed(() => {
    this.dataChanges.version();
    return new Date();
  });
  readonly monthName = computed(() =>
    this.today().toLocaleString('en-CA', { month: 'long', year: 'numeric' }),
  );

  readonly yearReport = rxResource({
    params: () => this.dataChanges.version(),
    stream: () => this.reportsRepository.getMonthlyCategorizedGraph(),
  });
  readonly monthReport = rxResource({
    params: () => this.dataChanges.version(),
    stream: () => this.reportsRepository.getCurrentMonthCategorizedGraph(),
  });
  readonly cashFlow = rxResource({
    params: () => this.dataChanges.version(),
    stream: () => this.reportsRepository.getCashFlow(),
  });
  readonly budgets = rxResource({
    params: () => this.dataChanges.version(),
    stream: () => this.budgetRepository.filter({ status: Status.Active, page: 1, pageSize: 1000 }),
  });
  readonly forecast = rxResource({
    params: () => this.dataChanges.version(),
    stream: () => this.reportsRepository.getForecast(),
  });
  readonly uncategorised = rxResource({
    params: () => this.dataChanges.version(),
    stream: () => this.reportsRepository.getUncategorised(),
  });
  /** Transactions left in Other that a rule could sort; 0 while unknown. */
  readonly unsortedCount = computed(() => valueOf(this.uncategorised)?.transactionCount ?? 0);

  readonly netWorth = rxResource({
    params: () => this.dataChanges.version(),
    stream: () => this.reportsRepository.getNetWorth(),
  });
  readonly accounts = rxResource({
    params: () => this.dataChanges.version(),
    stream: () => this.accountRepository.getAll(),
  });
  readonly recurring = rxResource({
    params: () => this.dataChanges.version(),
    stream: () => this.reportsRepository.getRecurring(),
  });

  readonly recent = rxResource({
    params: () => this.dataChanges.version(),
    stream: () => this.transactionRepository.filter({ page: 1, pageSize: RECENT_TRANSACTIONS }),
  });

  // The reports, or nothing while they load or when they failed: reading a failed one would break the page.
  readonly yearValue = computed(() => valueOf(this.yearReport));
  readonly monthValue = computed(() => valueOf(this.monthReport));

  readonly spent = computed(() => {
    const month = valueOf(this.monthReport);
    return month ? spentThisMonth(month) : null;
  });

  readonly spentHint = computed<{ text: string; tone: StatTone; up: boolean } | null>(() => {
    const spent = this.spent();
    const month = valueOf(this.monthReport);
    if (spent === null || !month) return null;
    // Like for like: last month up to the same day, not all of it against a month in progress.
    const change = percentChange(spent, month.previousMonthToDateTotal ?? null);
    if (change === null) return null;
    return {
      text: `${Math.abs(change).toFixed(0)}% ${change >= 0 ? 'more' : 'less'} than ${previousMonthToDateLabel(this.today())}`,
      tone: change > 0 ? 'bad' : 'good',
      up: change >= 0,
    };
  });

  /**
   * This month against a usual one at the same point: the monthly average spread evenly over the month, up to
   * today. A whole usual month against a few days of this one would always read as far under.
   */
  readonly usualHint = computed<{ text: string; tone: StatTone; up: boolean } | null>(() => {
    const spent = this.spent();
    const year = valueOf(this.yearReport);
    if (spent === null || !year || year.averageMonthlyTotal <= 0) return null;
    // With no month of the year over yet (every January), the API averages the running month itself: this month
    // against itself. The like-for-like comparison with last month says it instead.
    const runningMonthOnly =
      year.averageIncludesCurrentMonth ??
      !anyMonthFinished(
        year.monthlyData.map((month) => month.month),
        this.today(),
      );
    if (runningMonthOnly) return null;
    const expected = usualByNow(year.averageMonthlyTotal, this.today());
    const difference = spent - expected;
    return {
      text: `${this.format(Math.abs(difference))} ${difference > 0 ? 'over' : 'under'} a usual month by now`,
      tone: difference > 0 ? 'bad' : 'good',
      up: difference > 0,
    };
  });

  readonly leftOver = computed(() => {
    const report = valueOf(this.cashFlow);
    return report ? leftOverThisMonth(report, this.today()) : undefined;
  });
  readonly leftOverHint = computed<{ text: string; tone: StatTone }>(() => {
    const month = this.leftOver();
    if (!month) return { text: 'No income or spending yet', tone: 'neutral' };
    // Before payday, spending alone isn't a warning.
    if (month.income === 0) return { text: 'No income yet this month', tone: 'neutral' };
    return month.net >= 0
      ? { text: 'Income less spending so far', tone: 'good' }
      : { text: 'More went out than came in', tone: 'bad' };
  });

  readonly netWorthValue = computed(() => valueOf(this.netWorth));
  readonly netWorthHint = computed<{ text: string; tone: StatTone; up: boolean } | null>(() => {
    const report = this.netWorthValue();
    if (!report) return null;
    // Nothing to go on until a balance is entered (or a statement brings one).
    if (report.months.length === 0) {
      return { text: 'Enter a balance to start', tone: 'neutral', up: true };
    }
    const change = netWorthChange(report.months);
    if (change === null) return null;
    return {
      text: `${change >= 0 ? '+' : '−'}${this.format(Math.abs(change))} since last month`,
      tone: change > 0 ? 'good' : change < 0 ? 'bad' : 'neutral',
      up: change >= 0,
    };
  });

  /** Waits for what it is made of, so items don't appear one by one; a part that failed just adds nothing. */
  readonly attention = computed(() => {
    const parts = [this.uncategorised, this.budgets, this.recurring, this.accounts];
    if (parts.some((part) => part.isLoading())) return [];
    return attentionItems(
      {
        unsorted: this.unsortedCount(),
        budgets: valueOf(this.budgets)?.items ?? [],
        recurring: valueOf(this.recurring) ?? null,
        accounts: valueOf(this.accounts) ?? [],
      },
      this.today(),
    );
  });
  protected readonly attentionIcons: Record<AttentionKind, IconName> = {
    budget: 'budgets',
    statement: 'upload',
    price: 'refresh',
    unsorted: 'tag',
  };

  readonly investments = computed(() => investments(valueOf(this.accounts) ?? []));
  protected readonly planLabels = PLAN_LABELS;
  protected readonly formatDay = formatDay;

  /** The category card shows this month's split, or each category against a usual month. */
  readonly categoryView = signal<'month' | 'usual'>('month');

  readonly budgetSummary = computed(() => {
    const items = valueOf(this.budgets)?.items;
    if (!items) return null;
    const over = budgetsOverLimit(items);
    return { total: items.length, over };
  });

  format(amount: number): string {
    return formatCurrency(amount);
  }
}
