import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  ChartConfiguration,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { ReportsRepository } from '../../core/api/reports-repository';
import { ThemeService } from '../../core/theme/theme.service';
import { RegisteredPlan } from '../../core/models/enums/registered-plan';
import {
  NetWorthAccountDto,
  NetWorthReportDto,
} from '../../core/models/outputs/net-worth-output-dto';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { StatCardComponent } from '../../shared/ui/stat-card/stat-card.component';
import { ACCOUNT_TYPE_LABELS, PLAN_LABELS } from '../../shared/utils/account-labels';
import { valueOf } from '../../shared/utils/resource-value';
import {
  BAR_MARKS,
  chartTheme,
  ChartTheme,
  categoryAxis,
  tooltipStyle,
  valueAxis,
} from '../../shared/charts/chart-theme';
import { formatCurrency } from '../../shared/utils/format';
import { MoneyPipe } from '../../shared/pipes/money.pipe';

Chart.register(CategoryScale, LinearScale, BarElement, BarController, Tooltip);

/** The net worth chart: a bar per month, its assets and card debt in the tooltip. */
export function netWorthChart(
  report: NetWorthReportDto,
  theme: ChartTheme,
): ChartConfiguration<'bar'> {
  return {
    type: 'bar',
    data: {
      labels: report.months.map((m) => m.month),
      datasets: [
        {
          label: 'Net worth',
          data: report.months.map((m) => m.netWorth),
          backgroundColor: theme.series.blue,
          ...BAR_MARKS,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tooltipStyle(theme),
          callbacks: {
            label: (item) => `Net worth ${formatCurrency(Number(item.raw))}`,
            footer: (items) => {
              const month = report.months[items[0]?.dataIndex ?? 0];
              if (!month) return '';
              return [
                `Assets ${formatCurrency(month.assets)}`,
                `Owed on cards ${formatCurrency(month.liabilities)}`,
              ];
            },
          },
        },
      },
      scales: { x: categoryAxis(theme), y: valueAxis(theme) },
    },
  };
}

/**
 * What everything is worth: today's net worth, its assets and card debt, how it moved over the last twelve months, and
 * each account's balance (from the balances entered on Accounts, carried on by the transactions since).
 */
@Component({
  selector: 'app-net-worth',
  imports: [
    MoneyPipe,
    DatePipe,
    RouterLink,
    BaseChartDirective,
    ErrorStateComponent,
    SkeletonComponent,
    StatCardComponent,
  ],
  template: `
    <div class="mb-4">
      <h1 class="h3 mb-1">Net worth</h1>
      <p class="text-body-secondary mb-0">
        What your accounts and investments hold, less what your cards owe
      </p>
    </div>

    @if (report.error()) {
      <div class="card">
        <div class="card-body">
          <app-error-state message="Could not work out your net worth." (retry)="report.reload()" />
        </div>
      </div>
    } @else if (value(); as report) {
      @if (known().length === 0) {
        <div class="card">
          <div class="card-body text-center text-body-secondary py-5">
            <p class="mb-1">No balances entered yet.</p>
            <p class="small mb-3">
              Enter what each account holds today (what a card owes) on Accounts. From there, the
              transactions you import keep it up to date; enter an investment's value now and then.
            </p>
            <a routerLink="/accounts" class="btn btn-primary btn-sm">Go to Accounts</a>
          </div>
        </div>
      } @else {
        <div class="row row-cols-1 row-cols-sm-3 g-3 mb-3">
          <div class="col">
            <app-stat-card
              label="Net worth"
              icon="trending-up"
              [value]="format(report.netWorth)"
              [hint]="change()"
              [tone]="changeTone()"
            />
          </div>
          <div class="col">
            <app-stat-card label="Assets" icon="bank" [value]="format(report.assets)" />
          </div>
          <div class="col">
            <app-stat-card
              label="Owed on cards"
              icon="budgets"
              [value]="format(report.liabilities)"
            />
          </div>
        </div>

        @if (report.months.length > 1) {
          <div class="card mb-3">
            <div class="card-body">
              <h2 class="h6 mb-3">The last twelve months</h2>
              <div style="position: relative; width: 100%; height: 16rem">
                <canvas baseChart [data]="chart().data" [options]="chart().options" type="bar">
                </canvas>
              </div>
              @if (partial()) {
                <p class="small text-body-secondary mt-2 mb-0">
                  Earlier months leave out accounts whose history starts later.
                </p>
              }
              <table class="visually-hidden">
                <caption>
                  Net worth at the end of each month
                </caption>
                <tr>
                  <th scope="col">Month</th>
                  <th scope="col">Assets</th>
                  <th scope="col">Owed on cards</th>
                  <th scope="col">Net worth</th>
                </tr>
                @for (month of report.months; track month.month) {
                  <tr>
                    <th scope="row">{{ month.month }}</th>
                    <td>{{ month.assets | money }}</td>
                    <td>{{ month.liabilities | money }}</td>
                    <td>{{ month.netWorth | money }}</td>
                  </tr>
                }
              </table>
            </div>
          </div>
        }

        <div class="card">
          <ul class="list-group list-group-flush" aria-label="Accounts">
            @for (account of report.accounts; track account.id) {
              <li class="list-group-item d-flex align-items-center gap-3">
                <div class="flex-grow-1 min-w-0">
                  <div class="fw-medium text-truncate">{{ account.name }}</div>
                  <div class="small text-body-secondary">{{ describe(account) }}</div>
                </div>
                @if (account.balance !== null) {
                  <div class="text-end">
                    <div class="fw-semibold" [class.text-danger]="account.isLiability">
                      {{ account.isLiability ? '−' : '' }}{{ account.balance | money }}
                    </div>
                    <div class="small text-body-secondary">
                      {{ account.movedSince ? 'Entered' : 'As of' }}
                      {{ account.balanceDate | date: 'MMM d, y' : 'UTC'
                      }}{{ account.movedSince ? ', moved since' : '' }}
                    </div>
                  </div>
                } @else {
                  <a routerLink="/accounts" class="small text-nowrap">Add its balance</a>
                }
              </li>
            }
          </ul>
        </div>
      }
    } @else {
      <app-skeleton [lines]="6" height="2rem" />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NetWorthComponent {
  private readonly reports = inject(ReportsRepository);
  private readonly theme = inject(ThemeService);

  readonly report = rxResource({ stream: () => this.reports.getNetWorth() });
  readonly value = computed(() => valueOf(this.report));
  readonly known = computed(() => (this.value()?.accounts ?? []).filter((a) => a.balance !== null));
  readonly chart = computed(() => netWorthChart(this.value()!, chartTheme(this.theme.theme())));
  /** Some month counted fewer accounts than today. */
  readonly partial = computed(() =>
    (this.value()?.months ?? []).some((m) => m.accountsCounted < this.known().length),
  );

  /** Since the end of last month, when that month is known for every account. */
  private readonly sinceLastMonth = computed(() => {
    const months = this.value()?.months ?? [];
    if (months.length < 2) return null;
    const [before, now] = months.slice(-2);
    if (before.accountsCounted < now.accountsCounted) return null;
    return now.netWorth - before.netWorth;
  });
  readonly change = computed(() => {
    const change = this.sinceLastMonth();
    if (change === null) return null;
    return `${change >= 0 ? '+' : '−'}${this.format(Math.abs(change))} since last month`;
  });
  readonly changeTone = computed(() => {
    const change = this.sinceLastMonth() ?? 0;
    return change > 0 ? 'good' : change < 0 ? 'bad' : 'neutral';
  });

  format(amount: number): string {
    return formatCurrency(amount);
  }

  describe(account: NetWorthAccountDto): string {
    const type = ACCOUNT_TYPE_LABELS[account.type];
    return account.plan && account.plan !== RegisteredPlan.None
      ? `${type} · ${PLAN_LABELS[account.plan]}`
      : type;
  }
}
