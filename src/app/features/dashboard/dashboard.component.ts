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
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { FinanceTilesComponent } from './finance-tiles/finance-tiles.component';
import { MonthlyCategorizedChartComponent } from './monthly-categorized-chart/monthly-categorized-chart.component';
import { CategoryBreakdownComponent } from './category-breakdown/category-breakdown.component';
import { BudgetOverviewComponent } from './budget-overview/budget-overview.component';
import { RecentTransactionsComponent } from './recent-transactions/recent-transactions.component';
import { CategoryAveragesComponent } from './category-averages/category-averages.component';
import { CashFlowComponent } from './cash-flow/cash-flow.component';
import { MonthForecastComponent } from './month-forecast/month-forecast.component';
import { investments } from './investments';
import { AccountRepository } from '../../core/api/account-repository';
import { DataChangesService } from '../../core/data/data-changes.service';
import { PLAN_LABELS } from '../../shared/utils/account-labels';
import { keptValueOf, valueOf } from '../../shared/utils/resource-value';
import { formatDay, formatCurrency } from '../../shared/utils/format';
import { AlertRepository } from '../../core/api/alert-repository';
import { AttentionListComponent } from '../today/attention-list/attention-list.component';
import { HttpErrorResponse } from '@angular/common/http';

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
/** The module name of the finance alerts in `GET /api/alerts`. */
const MONEY = 'Money';

@Component({
  selector: 'app-dashboard',
  imports: [
    RouterLink,
    CardWrapperComponent,
    ErrorStateComponent,
    IconComponent,
    SkeletonComponent,
    FinanceTilesComponent,
    MonthlyCategorizedChartComponent,
    CategoryBreakdownComponent,
    CategoryAveragesComponent,
    BudgetOverviewComponent,
    RecentTransactionsComponent,
    CashFlowComponent,
    MonthForecastComponent,
    AttentionListComponent,
  ],
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private readonly reportsRepository = inject(ReportsRepository);
  private readonly budgetRepository = inject(BudgetRepository);
  private readonly transactionRepository = inject(TransactionRepository);
  private readonly accountRepository = inject(AccountRepository);
  private readonly alertRepository = inject(AlertRepository);
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
  readonly netWorth = rxResource({
    params: () => this.dataChanges.version(),
    stream: () => this.reportsRepository.getNetWorth(),
  });
  readonly accounts = rxResource({
    params: () => this.dataChanges.version(),
    stream: () => this.accountRepository.getAll(),
  });
  readonly recent = rxResource({
    params: () => this.dataChanges.version(),
    stream: () => this.transactionRepository.filter({ page: 1, pageSize: RECENT_TRANSACTIONS }),
  });

  // The reports, or nothing while they load or when they failed: reading a failed one would break the page.
  readonly yearValue = computed(() => valueOf(this.yearReport));
  readonly monthValue = computed(() => valueOf(this.monthReport));

  /** Clicks on "Retry" of the "Needs attention" list. */
  private readonly alertRetries = signal(0);
  /** The data version when the page opened: a later version means the data changed since. */
  private readonly firstVersion = this.dataChanges.version();

  /**
   * The open alerts of all modules (T15). The first load uses the alerts that the server keeps. A retry, or a change to
   * the data from this app, asks for a new check (`refresh=true`), as Today does.
   */
  readonly alerts = rxResource({
    params: () => ({ version: this.dataChanges.version(), retries: this.alertRetries() }),
    stream: ({ params }) =>
      this.alertRepository.get(params.retries > 0 || params.version !== this.firstVersion),
  });
  /** The last answer stays while the next one loads, so a new check does not hide the list for a moment. */
  private readonly alertList = keptValueOf(this.alerts);

  /**
   * The Money items of "Needs attention", in the order of the server (most severe first, then newest). The server owns
   * the rules, so the dashboard and Today show the same items.
   */
  readonly attention = computed(() =>
    (this.alertList()?.alerts ?? []).filter((alert) => alert.module === MONEY),
  );
  /** The status of the last check of the Money rules; Complete when the server does not say. */
  readonly attentionStatus = computed(
    () => this.alertList()?.modules.find((m) => m.module === MONEY)?.status ?? 'Complete',
  );
  /**
   * The alerts did not load. A 404 means that the API behind the app has no Alerts module (the finance backend alone):
   * then the list just does not show, as before there were alerts.
   */
  readonly attentionError = computed(() => {
    const error = this.alerts.error();
    if (!error || this.alertList()) return false;
    return !(error instanceof HttpErrorResponse && error.status === 404);
  });

  /** Asks the server for a new check of the alerts. */
  retryAttention(): void {
    this.alertRetries.update((n) => n + 1);
  }

  readonly investments = computed(() => investments(valueOf(this.accounts) ?? []));
  protected readonly planLabels = PLAN_LABELS;
  protected readonly formatDay = formatDay;

  /** The category card shows this month's split, or each category against a usual month. */
  readonly categoryView = signal<'month' | 'usual'>('month');

  format(amount: number): string {
    return formatCurrency(amount);
  }
}
