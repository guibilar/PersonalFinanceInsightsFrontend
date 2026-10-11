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
import { FinanceTilesComponent } from './finance-tiles/finance-tiles.component';
import { MonthlyCategorizedChartComponent } from './monthly-categorized-chart/monthly-categorized-chart.component';
import { CategoryBreakdownComponent } from './category-breakdown/category-breakdown.component';
import { BudgetOverviewComponent } from './budget-overview/budget-overview.component';
import { RecentTransactionsComponent } from './recent-transactions/recent-transactions.component';
import { CategoryAveragesComponent } from './category-averages/category-averages.component';
import { CashFlowComponent } from './cash-flow/cash-flow.component';
import { MonthForecastComponent } from './month-forecast/month-forecast.component';
import { AttentionKind, attentionItems } from './attention';
import { investments } from './investments';
import { AccountRepository } from '../../core/api/account-repository';
import { DataChangesService } from '../../core/data/data-changes.service';
import { PLAN_LABELS } from '../../shared/utils/account-labels';
import { valueOf } from '../../shared/utils/resource-value';
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
    FinanceTilesComponent,
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

  format(amount: number): string {
    return formatCurrency(amount);
  }
}
