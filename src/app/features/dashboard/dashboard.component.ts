import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
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
import { StatCardComponent, StatTone } from '../../shared/ui/stat-card/stat-card.component';
import { MonthlyCategorizedChartComponent } from './monthly-categorized-chart/monthly-categorized-chart.component';
import { CategoryBreakdownComponent } from './category-breakdown/category-breakdown.component';
import { BudgetOverviewComponent } from './budget-overview/budget-overview.component';
import { RecentTransactionsComponent } from './recent-transactions/recent-transactions.component';
import {
  budgetsOverLimit,
  categoryShares,
  monthLabel,
  percentChange,
  previousMonthTotal,
  spentThisMonth,
} from './dashboard-stats';

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
    BudgetOverviewComponent,
    RecentTransactionsComponent,
  ],
  templateUrl: './dashboard.component.html',
  providers: [CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private readonly reportsRepository = inject(ReportsRepository);
  private readonly budgetRepository = inject(BudgetRepository);
  private readonly transactionRepository = inject(TransactionRepository);
  private readonly currency = inject(CurrencyPipe);

  readonly today = new Date();
  readonly monthName = this.today.toLocaleString('en-CA', { month: 'long', year: 'numeric' });

  readonly yearReport = rxResource({
    stream: () => this.reportsRepository.getMonthlyCategorizedGraph(),
  });
  readonly monthReport = rxResource({
    stream: () => this.reportsRepository.getCurrentMonthCategorizedGraph(),
  });
  readonly budgets = rxResource({
    stream: () => this.budgetRepository.filter({ status: Status.Active, page: 1, pageSize: 1000 }),
  });
  readonly recent = rxResource({
    stream: () => this.transactionRepository.filter({ page: 1, pageSize: RECENT_TRANSACTIONS }),
  });

  readonly spent = computed(() => {
    const month = this.monthReport.value();
    return month ? spentThisMonth(month) : null;
  });

  readonly spentHint = computed<{ text: string; tone: StatTone; up: boolean } | null>(() => {
    const spent = this.spent();
    const year = this.yearReport.value();
    if (spent === null || !year) return null;
    const previous = previousMonthTotal(year, this.today);
    const change = percentChange(spent, previous);
    if (change === null) return null;
    const lastMonth = new Date(
      Date.UTC(this.today.getUTCFullYear(), this.today.getUTCMonth() - 1, 1),
    );
    return {
      text: `${Math.abs(change).toFixed(0)}% ${change >= 0 ? 'more' : 'less'} than ${monthLabel(lastMonth).split(' ')[0]}`,
      tone: change > 0 ? 'bad' : 'good',
      up: change >= 0,
    };
  });

  readonly topCategory = computed(() => {
    const month = this.monthReport.value();
    return month ? (categoryShares(month)[0] ?? null) : null;
  });

  readonly budgetSummary = computed(() => {
    const items = this.budgets.value()?.items;
    if (!items) return null;
    const over = budgetsOverLimit(items);
    return { total: items.length, over };
  });

  format(amount: number): string {
    return this.currency.transform(amount) ?? '';
  }
}
