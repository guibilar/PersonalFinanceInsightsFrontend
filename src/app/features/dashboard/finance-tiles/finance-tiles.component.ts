import { ChangeDetectionStrategy, Component, Resource, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CategorizedReportOutputDto } from '../../../core/models/outputs/categorized-report-output-dto';
import { CashFlowReportOutputDto } from '../../../core/models/outputs/cash-flow-report-output-dto';
import { NetWorthReportDto } from '../../../core/models/outputs/net-worth-output-dto';
import { BudgetOutputDto } from '../../../core/models/outputs/budget-output-dto';
import { PaginatedResult } from '../../../core/models/outputs/paginated-result-output-dto';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { StatCardComponent, StatTone } from '../../../shared/ui/stat-card/stat-card.component';
import { valueOf } from '../../../shared/utils/resource-value';
import { anyMonthFinished } from '../../../shared/utils/months';
import { formatCurrency } from '../../../shared/utils/format';
import { moneyPath } from '../../money/money-paths';
import {
  budgetsOverLimit,
  leftOverThisMonth,
  netWorthChange,
  percentChange,
  previousMonthToDateLabel,
  spentThisMonth,
  usualByNow,
} from '../dashboard-stats';

interface Hint {
  text: string;
  tone: StatTone;
  up: boolean;
}

/**
 * The four headline numbers of Money: spent this month, left over, net worth and budgets over their limit, on the
 * Dashboard. The page loads the reports and passes them in, so it asks once for what its other cards also use.
 * Today shows the same tiles from the Today API of Hestia.Api (T10); the server has a copy of these rules.
 */
@Component({
  selector: 'app-finance-tiles',
  imports: [RouterLink, SkeletonComponent, StatCardComponent],
  templateUrl: './finance-tiles.component.html',
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
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinanceTilesComponent {
  readonly monthReport = input.required<Resource<CategorizedReportOutputDto | undefined>>();
  readonly yearReport = input.required<Resource<CategorizedReportOutputDto | undefined>>();
  readonly cashFlow = input.required<Resource<CashFlowReportOutputDto | undefined>>();
  readonly netWorth = input.required<Resource<NetWorthReportDto | undefined>>();
  readonly budgets = input.required<Resource<PaginatedResult<BudgetOutputDto> | undefined>>();
  /** The day the figures are for; the page reads it again when its data reloads. */
  readonly today = input.required<Date>();

  protected readonly netWorthLink = moneyPath('net-worth');
  protected readonly budgetsLink = moneyPath('budgets');

  readonly spent = computed(() => {
    const month = valueOf(this.monthReport());
    return month ? spentThisMonth(month) : null;
  });

  readonly spentHint = computed<Hint | null>(() => {
    const spent = this.spent();
    const month = valueOf(this.monthReport());
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
  readonly usualHint = computed<Hint | null>(() => {
    const spent = this.spent();
    const year = valueOf(this.yearReport());
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
    const report = valueOf(this.cashFlow());
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

  readonly netWorthValue = computed(() => valueOf(this.netWorth()));
  readonly netWorthHint = computed<Hint | null>(() => {
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

  readonly budgetSummary = computed(() => {
    const items = valueOf(this.budgets())?.items;
    if (!items) return null;
    const over = budgetsOverLimit(items);
    return { total: items.length, over };
  });

  format(amount: number): string {
    return formatCurrency(amount);
  }
}
